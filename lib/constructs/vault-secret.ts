import * as cdk from 'aws-cdk-lib';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

import { VaultSecretPayload } from '../utils/vault-secret';

export interface VaultSecretProps {
    provisioner: lambda.IFunction;
    payload: VaultSecretPayload;
}

export class VaultSecret extends Construct {
    constructor(scope: Construct, id: string, props: VaultSecretProps) {
        super(scope, id);

        const provider = new cr.Provider(this, 'Provider', {
            onEventHandler: props.provisioner,
        });

        new cdk.CustomResource(this, 'Resource', {
            serviceToken: provider.serviceToken,
            properties: {
                mountPoint: props.payload.mountPoint,
                path: props.payload.path,
                secret: props.payload.secret,
            },
        });
    }
}