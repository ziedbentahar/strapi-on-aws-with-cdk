import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import {
  IVpc,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
} from "aws-cdk-lib/aws-ec2";
import {
  AuroraPostgresEngineVersion,
  ClusterInstance,
  Credentials,
  DatabaseCluster,
  DatabaseClusterEngine,
  IDatabaseCluster,
} from "aws-cdk-lib/aws-rds";
import { ISecret, Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

interface DatabaseProps extends NestedStackProps {
  vpc: IVpc;
  applicationName: string;
}

class Database extends NestedStack {
  public readonly dbCluster: IDatabaseCluster;
  public readonly dbSecret: ISecret;
  public readonly dbName: string;

  constructor(scope: Construct, id: string, props?: DatabaseProps) {
    super(scope, id, props);
    const { vpc, applicationName } = props!;
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
          username: applicationName,
        }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: "password",
      },
    });

    this.dbCluster = new DatabaseCluster(this, "Database", {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_14_7,
      }),
      defaultDatabaseName: applicationName,
      writer: ClusterInstance.serverlessV2("writer"),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 1,
      readers: [
        ClusterInstance.serverlessV2("reader", { scaleWithWriter: true }),
      ],
      vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: SubnetType.PRIVATE_ISOLATED,
      }),
      credentials: Credentials.fromPassword(
        this.dbSecret.secretValueFromJson("username").unsafeUnwrap(),
        this.dbSecret.secretValueFromJson("password")
      ),
      port: 5432,
      securityGroups: [dbSecurityGroup],
    });
  }
}

export default Database;
