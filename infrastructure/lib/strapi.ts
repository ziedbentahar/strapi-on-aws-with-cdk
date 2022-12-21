import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Certificate } from "./certificate";
import Database from "./database";
import { ECSService } from "./ecs-service";
import { Route53Record } from "./route53-record";
import { StrapiVpc } from "./vpc";

class StrapiStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new StrapiVpc(this, StrapiVpc.name, {});

    const applicationName = this.node.tryGetContext("applicationName");
    const hostedZoneDomainName = this.node.tryGetContext(
      "hostedZoneDomainName"
    );
    const authorizedIPsForAdminAccess = this.node.tryGetContext(
      "authorizedIPsForAdminAccess"
    );

    const domainName = `${applicationName}.${hostedZoneDomainName}`;

    const database = new Database(this, Database.name, {
      applicationName,
      vpc: vpc.vpc,
    });

    const certificate = new Certificate(this, Certificate.name, {
      hostedZoneDomainName,
      domainName,
    });

    const ecsServiceStack = new ECSService(this, ECSService.name, {
      certificate: certificate.certificate,
      dbHostname: database.dbCluster.clusterEndpoint.hostname.toString(),
      dbPort: database.dbCluster.clusterEndpoint.port.toString(),
      dbName: applicationName,
      dbSecret: database.dbSecret,
      vpc: vpc.vpc,
      applicationName,
      authorizedIPsForAdminAccess,
    });

    const records = new Route53Record(this, Route53Record.name, {
      hostedZoneDomainName,
      applicationName,
      loadBalancer: ecsServiceStack.loadBalancer,
    });
  }
}

export { StrapiStack };
