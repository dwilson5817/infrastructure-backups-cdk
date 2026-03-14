import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'node:path';

export interface VaultSecretProviderProps {
    vaultAddr: string;
    vaultRole: string;
}

export class VaultSecretProvider extends Construct {
    public readonly role: iam.Role;
    public readonly function: lambda.Function;

    constructor(scope: Construct, id: string, props: VaultSecretProviderProps) {
        super(scope, id);

        this.role = new iam.Role(this, 'Role', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });

        this.role.addToPolicy(new iam.PolicyStatement({
            actions: ['sts:GetCallerIdentity'],
            resources: ['*'],
        }));

        const logGroup = new logs.LogGroup(this, 'LogGroup', {
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        this.function = new lambda.Function(this, 'Function', {
            runtime: lambda.Runtime.PYTHON_3_13,
            handler: 'main.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/vault_secret_custom_resource'), {
                bundling: {
                    image: cdk.DockerImage.fromRegistry('python:3.13'),
                    command: [
                        'bash',
                        '-c',
                        'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output',
                    ],
                },
            }),
            description: 'Handles CloudFormation lifecycle events for Vault secrets.',
            timeout: cdk.Duration.seconds(30),
            logGroup,
            role: this.role,
            environment: {
                VAULT_ADDR: props.vaultAddr,
                VAULT_ROLE: props.vaultRole,
            },
        });
    }
}