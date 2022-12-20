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

    const database = new Database(this, Database.name, {
      applicationName,
      vpc: vpc.vpc,
    });

    const certificate = new Certificate(this, Certificate.name, {
      hostedZoneDomainName: this.node.tryGetContext("hostedZoneDomainName"),
      domainName: this.node.tryGetContext("domainName"),
    });

    const ecsServiceStack = new ECSService(this, ECSService.name, {
      certificate: certificate.certificate,
      dbHostname: database.dbCluster.clusterEndpoint.hostname.toString(),
      dbPort: database.dbCluster.clusterEndpoint.port.toString(),
      dbName: this.node.tryGetContext("applicationName"),
      dbSecret: database.dbSecret,
      vpc: vpc.vpc,
      applicationName,
    });

    const records = new Route53Record(this, Route53Record.name, {
      hostedZoneDomainName: this.node.tryGetContext("hostedZoneDomainName"),
      loadBalancer: ecsServiceStack.loadBalancer,
    });
  }
}

export { StrapiStack };
