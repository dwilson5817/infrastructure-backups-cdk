import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as rolesanywhere from 'aws-cdk-lib/aws-rolesanywhere';

interface HostToGuests {
  [host: string]: string[]
}

const hostsToBackup: HostToGuests = {
  'london.dylanw.net': ['git01', 'sql01', 'web01', 'game01', 'game02']
};

export class InfrastructureBackupsCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new s3.Bucket(this, 'ArchiveBucket', {
      bucketName: 'dylanw.net-archive',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
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

      new rolesanywhere.CfnProfile(this, `RoleAnywhereProfile-${hostname}`, {
        name: hostname,
        roleArns: [ role.roleArn ],
      });
    }));
  }
}
