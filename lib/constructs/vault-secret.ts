import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { VaultSecretPayload } from '../utils/vault-secret';

export interface VaultSecretProps {
    serviceToken: string;
    payload: VaultSecretPayload;
}

export class VaultSecret extends Construct {
    constructor(scope: Construct, id: string, props: VaultSecretProps) {
        super(scope, id);

        new cdk.CustomResource(this, 'Resource', {
            serviceToken: props.serviceToken,
            properties: {
                mountPoint: props.payload.mountPoint,
                path: props.payload.path,
                secret: props.payload.secret,
            },
        });
    }
}