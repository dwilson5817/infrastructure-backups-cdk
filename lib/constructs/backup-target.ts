import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as rolesanywhere from 'aws-cdk-lib/aws-rolesanywhere';
import * as s3 from 'aws-cdk-lib/aws-s3';

import { toResourceSuffix } from '../utils/hostnames';
import { buildBackupVaultSecretPayload } from '../utils/vault-secret';
import { VaultSecret } from './vault-secret';

export interface BackupTargetProps {
    hostname: string;
    trustAnchorArn: string;
    provider: lambda.IFunction;
}

export class BackupTarget extends Construct {
    public readonly role: iam.Role;
    public readonly bucket: s3.Bucket;
    public readonly profile: rolesanywhere.CfnProfile;

    constructor(scope: Construct, id: string, props: BackupTargetProps) {
        super(scope, id);

        const resourceSuffix = toResourceSuffix(props.hostname);
        const rolesAnywherePrincipal = new iam.PrincipalWithConditions(
            new iam.ServicePrincipal('rolesanywhere.amazonaws.com'),
            {
                StringEquals: {
                    'aws:PrincipalTag/x509Subject/CN': props.hostname,
                },
            }
        );

        this.role = new iam.Role(this, 'BackupRole', {
            assumedBy: rolesAnywherePrincipal,
            description: `Backup role for ${props.hostname}`,
        });

        this.role.assumeRolePolicy?.addStatements(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                principals: [rolesAnywherePrincipal],
                actions: ['sts:TagSession', 'sts:SetSourceIdentity'],
            })
        );

        this.bucket = new s3.Bucket(this, 'BackupsBucket', {
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            autoDeleteObjects: false,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            versioned: true,
            lifecycleRules: [
                {
                    id: 'ArchiveBackups',
                    enabled: true,
                    transitions: [
                        {
                            storageClass: s3.StorageClass.DEEP_ARCHIVE,
                            transitionAfter: cdk.Duration.days(3),
                        },
                    ],
                },
            ],
        });

        this.role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                's3:ListBucket',
                's3:GetBucketLocation',
            ],
            resources: [this.bucket.bucketArn],
        }));

        this.role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                's3:PutObject',
                's3:AbortMultipartUpload',
            ],
            resources: [this.bucket.arnForObjects('*')],
        }));

        this.profile = new rolesanywhere.CfnProfile(this, 'RolesAnywhereProfile', {
            name: resourceSuffix,
            roleArns: [this.role.roleArn],
            enabled: true,
        });

        const vaultPayload = buildBackupVaultSecretPayload({
            hostname: props.hostname,
            bucketName: this.bucket.bucketName,
            trustAnchorArn: props.trustAnchorArn,
            profileArn: this.profile.attrProfileArn,
            roleArn: this.role.roleArn,
        });

        new VaultSecret(this, 'VaultSecret', {
            provider: props.provider,
            payload: vaultPayload,
        });
    }
}