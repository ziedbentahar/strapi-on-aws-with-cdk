import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { CertificateStack } from "./certificate";
import DatabaseStack from "./database";
import { ECSServiceStack } from "./ecs-service";
import { Route53RecordStack } from "./route53-record";
import { VpcStack } from "./vpc";

//const hostedZoneDomainName = "inflow-it-labs.tk";

class StrapiStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new VpcStack(this, VpcStack.name, {});
    const applicationName = this.node.tryGetContext("applicationName");

    const database = new DatabaseStack(this, DatabaseStack.name, {
      applicationName,
      vpc: vpc.vpc,
    });

    const certificate = new CertificateStack(this, CertificateStack.name, {
      hostedZoneDomainName: this.node.tryGetContext("hostedZoneDomainName"),
    });

    const ecsServiceStack = new ECSServiceStack(this, ECSServiceStack.name, {
      certificate: certificate.certificate,
      dbHostname: database.dbCluster.clusterEndpoint.hostname.toString(),
      dbPort: database.dbCluster.clusterEndpoint.port.toString(),
      dbName: this.node.tryGetContext("applicationName"),
      dbSecret: database.dbSecret,
      vpc: vpc.vpc,
      applicationName,
    });

    const records = new Route53RecordStack(this, Route53RecordStack.name, {
      hostedZoneDomainName: this.node.tryGetContext("hostedZoneDomainName"),
      loadBalancer: ecsServiceStack.loadBalancer,
    });
  }
}

export { StrapiStack };
