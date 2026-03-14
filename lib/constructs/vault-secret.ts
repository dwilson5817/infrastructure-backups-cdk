import { Construct } from 'constructs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { AwsSdkCall } from 'aws-cdk-lib/custom-resources';

import { hashVaultSecretPayload, VaultSecretPayload } from '../utils/vault-secret';

export interface VaultSecretProps {
    provisioner: lambda.IFunction;
    payload: VaultSecretPayload;
}

export class VaultSecret extends Construct {
    constructor(scope: Construct, id: string, props: VaultSecretProps) {
        super(scope, id);

        const payloadHash = hashVaultSecretPayload(props.payload);

        const invokeProvisionerCall: AwsSdkCall = {
            service: 'Lambda',
            action: 'invoke',
            parameters: {
                FunctionName: props.provisioner.functionName,
                Payload: JSON.stringify(props.payload),
            },
            physicalResourceId: cr.PhysicalResourceId.of(payloadHash),
        };

        new cr.AwsCustomResource(this, 'Resource', {
            onCreate: invokeProvisionerCall,
            onUpdate: invokeProvisionerCall,
            policy: cr.AwsCustomResourcePolicy.fromStatements([
                new iam.PolicyStatement({
                    actions: ['lambda:InvokeFunction'],
                    resources: [props.provisioner.functionArn],
                }),
            ]),
        });
    }
}