import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class InfrastructureBackupsCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new s3.Bucket(this, 'ArchiveBucket', {
      bucketName: 'dylanw.net-archive',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new s3.Bucket(this, 'DailyBackupsBucket', {
      bucketName: 'london.dylanw.net-backups',
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
  }
}
