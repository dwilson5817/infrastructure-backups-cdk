export interface VaultSecretPayload {
    mountPoint: string;
    path: string;
    secret: {
        backupsBucket: string;
        trustAnchorArn: string;
        profileArn: string;
        roleArn: string;
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
        mountPoint: 'secrets/infrastructure/ansible-playbooks',
        path: `aws/roles-anywhere/backups/${props.hostname}`,
        secret: {
            backupsBucket: props.bucketName,
            trustAnchorArn: props.trustAnchorArn,
            profileArn: props.profileArn,
            roleArn: props.roleArn,
        },
    };
}
