import { NestedStack, StackProps } from "aws-cdk-lib";
import { IpAddresses, IVpc, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export class StrapiVpc extends NestedStack {
  public readonly vpc: IVpc;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.vpc = new Vpc(this, "StrapiVPC", {
      ipAddresses: IpAddresses.cidr("10.0.0.0/24"),
      subnetConfiguration: [
        { name: "public-subnet", subnetType: SubnetType.PUBLIC },
        {
          name: "privat-subnet",
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          name: "isolated-subnet",
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });
  }
}
