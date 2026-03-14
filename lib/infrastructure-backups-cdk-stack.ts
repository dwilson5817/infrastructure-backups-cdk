import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rolesanywhere from 'aws-cdk-lib/aws-rolesanywhere';

import { hostsToBackup } from './config/backups-hosts';
import { BackupTarget } from './constructs/backup-target';
import { VaultSecretProvider } from './constructs/vault-secret-provider';
import { expandHostnames, toResourceSuffix } from './utils/hostnames';

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

    const vaultProvisioner = new VaultSecretProvider(this, 'VaultProvisioner', {
      vaultAddr: process.env.VAULT_ADDR!,
      vaultRole: process.env.VAULT_ROLE!,
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

    for (const hostname of expandHostnames(hostsToBackup)) {
      new BackupTarget(this, `BackupTarget-${toResourceSuffix(hostname)}`, {
        hostname,
        trustAnchorArn: trustAnchor.attrTrustAnchorArn,
        provisioner: vaultProvisioner.function,
      });
    }
  }
}
