import {
  aws_route53,
  aws_route53_targets,
  Duration,
  NestedStack,
  NestedStackProps,
} from "aws-cdk-lib";
import { IApplicationLoadBalancer } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";

export interface Route53RecordStackProps extends NestedStackProps {
  loadBalancer: IApplicationLoadBalancer;
  hostedZoneDomainName: string;
}

export class Route53RecordStack extends NestedStack {
  constructor(scope: Construct, id: string, props: Route53RecordStackProps) {
    super(scope, id, props);

    const { loadBalancer, hostedZoneDomainName } = props!;

    const hostedZone = aws_route53.HostedZone.fromLookup(this, "hosted-zone", {
      domainName: hostedZoneDomainName,
    });

    new aws_route53.ARecord(this, "a-dns-record", {
      recordName: "strapi",
      zone: hostedZone,
      target: aws_route53.RecordTarget.fromAlias(
        new aws_route53_targets.LoadBalancerTarget(loadBalancer)
      ),
      ttl: Duration.minutes(1),
    });

    new aws_route53.AaaaRecord(this, "aaaa-dns-record", {
      recordName: "strapi",
      zone: hostedZone,
      target: aws_route53.RecordTarget.fromAlias(
        new aws_route53_targets.LoadBalancerTarget(loadBalancer)
      ),
      ttl: Duration.minutes(1),
    });
  }
}
