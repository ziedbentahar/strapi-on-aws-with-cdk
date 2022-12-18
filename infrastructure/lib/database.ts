import { Aspects, NestedStack, NestedStackProps } from "aws-cdk-lib";
import {
  InstanceType,
  IVpc,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
} from "aws-cdk-lib/aws-ec2";
import {
  AuroraPostgresEngineVersion,
  CfnDBCluster,
  Credentials,
  DatabaseCluster,
  DatabaseClusterEngine,
  IDatabaseCluster,
} from "aws-cdk-lib/aws-rds";
import { ISecret, Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

interface DatabaseStackProps extends NestedStackProps {
  vpc: IVpc;
  applicationName: string;
}

class DatabaseStack extends NestedStack {
  public readonly dbCluster: IDatabaseCluster;
  public readonly dbSecret: ISecret;
  public readonly dbName: string;

  constructor(scope: Construct, id: string, props?: DatabaseStackProps) {
    super(scope, id, props);

    const { vpc, applicationName } = props!;

    const databaseName = applicationName;

    const dbSecurityGroup = new SecurityGroup(this, "DBClusterSecurityGroup", {
      vpc,
    });

    dbSecurityGroup.addIngressRule(
      Peer.ipv4(vpc.privateSubnets[0].ipv4CidrBlock),
      Port.tcp(5432)
    );

    this.dbSecret = new Secret(this, "DBCredentialsSecret", {
      secretName: `${applicationName}-credentials`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: databaseName,
        }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: "password",
      },
    });

    this.dbCluster = new DatabaseCluster(this, "DbCluster", {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_13_6,
      }),
      instances: 1,

      credentials: Credentials.fromPassword(
        this.dbSecret.secretValueFromJson("username").unsafeUnwrap(),
        this.dbSecret.secretValueFromJson("password")
      ),
      defaultDatabaseName: databaseName,

      instanceProps: {
        vpc: vpc,
        instanceType: new InstanceType("serverless"),
        autoMinorVersionUpgrade: true,
        securityGroups: [dbSecurityGroup],
        vpcSubnets: vpc.selectSubnets({
          subnetType: SubnetType.PRIVATE_ISOLATED,
        }),
      },
      port: 5432,
    });

    Aspects.of(this.dbCluster).add({
      visit(node) {
        if (node instanceof CfnDBCluster) {
          node.serverlessV2ScalingConfiguration = {
            minCapacity: 0.5,
            maxCapacity: 1,
          };
        }
      },
    });
  }
}

export default DatabaseStack;
