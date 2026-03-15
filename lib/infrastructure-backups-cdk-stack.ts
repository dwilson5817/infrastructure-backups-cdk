import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rolesanywhere from 'aws-cdk-lib/aws-rolesanywhere';

import { hostsToBackup } from './config/backups-hosts';
import { BackupTarget } from './constructs/backup-target';
import { VaultSecretProvider } from './constructs/vault-secret-provider';
import { expandHostnames, toResourceSuffix } from './utils/hostnames';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function validateHostnames(hostnames: string[]): void {
  if (hostnames.length === 0) {
    throw new Error('No backup hosts are configured.');
  }

  const uniqueHostnames = new Set(hostnames);
  if (uniqueHostnames.size !== hostnames.length) {
    throw new Error('Duplicate hostnames detected in backup host configuration.');
  }

  for (const hostname of hostnames) {
    const resourceSuffix = toResourceSuffix(hostname);
    if (!resourceSuffix) {
      throw new Error(`Hostname "${hostname}" does not produce a valid resource suffix.`);
    }
  }
}

export class InfrastructureBackupsCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vaultServerAccountId = '197315783321';
    const vaultAddr = requireEnv('VAULT_ADDR');
    const vaultRole = requireEnv('VAULT_ROLE');
    const rootCertificate = requireEnv('ROOT_CERTIFICATE');
    const backupHostnames = expandHostnames(hostsToBackup);

    validateHostnames(backupHostnames);

    const verificationRole = new iam.Role(this, 'VaultVerificationRole', {
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

    const vaultSecretProvider = new VaultSecretProvider(this, 'VaultSecretProvider', {
      vaultAddr,
      vaultRole,
    });

    const trustAnchor = new rolesanywhere.CfnTrustAnchor(this, 'VaultTrustAnchor', {
      name: 'Vault',
      source: {
        sourceData: {
          x509CertificateData: rootCertificate,
        },
        sourceType: 'CERTIFICATE_BUNDLE',
      },
      enabled: true,
    });

    for (const hostname of backupHostnames) {
      new BackupTarget(this, `BackupTarget-${toResourceSuffix(hostname)}`, {
        hostname,
        trustAnchorArn: trustAnchor.attrTrustAnchorArn,
        vaultSecretServiceToken: vaultSecretProvider.serviceToken,
      });
    }
  }
}