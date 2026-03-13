import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as rolesanywhere from 'aws-cdk-lib/aws-rolesanywhere';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as path from "node:path";
import { AwsSdkCall } from "aws-cdk-lib/custom-resources";
import * as crypto from 'crypto';

interface HostToGuests {
  [host: string]: string[]
}

const hostsToBackup: HostToGuests = {
  'london.dylanw.net': ['git01', 'sql01', 'web01', 'game01', 'game02']
};

export class InfrastructureBackupsCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vaultServerAccountId = '197315783321';

    const verificationRole = new iam.Role(this, 'VaultVerificationRole', {
      roleName: 'VaultVerificationRole',
      assumedBy: new iam.AccountPrincipal(vaultServerAccountId),
    });

    verificationRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'iam:GetRole',
        'iam:GetUser',
      ],
      resources: ['*'],
    }));

    const lambdaRole = new iam.Role(this, 'VaultProvisionerRole', {
      roleName: 'VaultProvisionerRole',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['sts:GetCallerIdentity'],
      resources: ['*'],
    }));

    const vaultProvisioner = new lambda.Function(this, 'VaultSecretProvisioner', {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'main.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/vault_secret_provisioner'), {
        bundling: {
          image: cdk.DockerImage.fromRegistry('python:3.13'),
          command: [
            'bash', '-c',
            'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output'
          ],
        },
      }),
      timeout: cdk.Duration.seconds(30),
      role: lambdaRole,
      environment: {
        VAULT_ADDR: process.env.VAULT_ADDR!,
        VAULT_ROLE: process.env.VAULT_ROLE!,
      },
    });

    const trustAnchor = new rolesanywhere.CfnTrustAnchor(this, 'VaultTrustAnchor', {
      name: 'Vault',
      source: {
        sourceData: {
          x509CertificateData: process.env.VAULT_INTERMEDIATE_CERT!,
        },
        sourceType: 'CERTIFICATE_BUNDLE',
      },
      enabled: true,
    });

    Object.keys(hostsToBackup).forEach(host => hostsToBackup[host].forEach(vm => {
      const hostname = `${vm}.${host}`;

      const role = new iam.Role(this, `BackupRole-${hostname}`, {
        assumedBy: new iam.ServicePrincipal('rolesanywhere.amazonaws.com'),
        roleName: `BackupRole-${hostname}`,
        description: `Backup role for ${hostname}`,
        externalIds: [],
      });

      role.assumeRolePolicy?.addStatements(
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('rolesanywhere.amazonaws.com')],
            actions: ['sts:AssumeRole', 'sts:TagSession', 'sts:SetSourceIdentity'],
            conditions: {
              StringEquals: {
                'aws:PrincipalTag/x509Subject/CN': hostname,
              },
            },
          })
      );

      const backupsBucket = new s3.Bucket(this, `BackupsBucket-${hostname}`, {
        bucketName: `${hostname}-backups`,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        lifecycleRules: [
          {
            id: 'TransitionToDeepArchive',
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

      backupsBucket.grantReadWrite(role);

      const profile = new rolesanywhere.CfnProfile(this, `RolesAnywhereProfile-${hostname}`, {
        name: hostname.replace(/\./g, '-'),
        roleArns: [ role.roleArn ],
        enabled: true,
      });

      const vaultSecret = {
        mount_point: 'secrets/infrastructure/ansible-playbooks',
        path: `aws/roles-anywhere/${hostname}`,
        secret: {
          trust_anchor_arn: trustAnchor.attrTrustAnchorArn,
          profile_arn: profile.attrProfileArn,
          role_arn: role.roleArn
        },
      };

      const secretHash = crypto
          .createHash('sha256')
          .update(JSON.stringify(vaultSecret))
          .digest('hex');

      const invokeLambdaCall: AwsSdkCall = {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: vaultProvisioner.functionName,
          Payload: JSON.stringify(vaultSecret),
        },
        physicalResourceId: cr.PhysicalResourceId.of(secretHash),
      };

      new cr.AwsCustomResource(this, `VaultSecret-${hostname}`, {
        onCreate: invokeLambdaCall,
        onUpdate: invokeLambdaCall,
        policy: cr.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            actions: ['lambda:InvokeFunction'],
            resources: [vaultProvisioner.functionArn],
          }),
        ]),
      });
    }));
  }
}
