import * as crypto from 'node:crypto';

export interface VaultSecretPayload {
    mount_point: string;
    path: string;
    secret: {
        backups_bucket: string;
        trust_anchor_arn: string;
        profile_arn: string;
        role_arn: string;
    };
}

export interface BuildBackupVaultSecretPayloadProps {
    hostname: string;
    bucketName: string;
    trustAnchorArn: string;
    profileArn: string;
    roleArn: string;
}

export function buildBackupVaultSecretPayload(
    props: BuildBackupVaultSecretPayloadProps
): VaultSecretPayload {
    return {
        mount_point: 'secrets/infrastructure/ansible-playbooks',
        path: `aws/roles-anywhere/${props.hostname}`,
        secret: {
            backups_bucket: props.bucketName,
            trust_anchor_arn: props.trustAnchorArn,
            profile_arn: props.profileArn,
            role_arn: props.roleArn,
        },
    };
}

export function hashVaultSecretPayload(payload: VaultSecretPayload): string {
    return crypto
        .createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');
}
