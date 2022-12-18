import {
  aws_certificatemanager,
  aws_route53,
  NestedStack,
  NestedStackProps,
} from "aws-cdk-lib";
import { ICertificate } from "aws-cdk-lib/aws-certificatemanager";
import { Construct } from "constructs";

export interface CertificateStackProps extends NestedStackProps {
  hostedZoneDomainName: string;
}

export class CertificateStack extends NestedStack {
  public readonly certificate: ICertificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    const { hostedZoneDomainName } = props!;

    const hostedZone = aws_route53.HostedZone.fromLookup(this, "hosted-zone", {
      domainName: hostedZoneDomainName,
    });

    this.certificate = new aws_certificatemanager.Certificate(
      this,
      "some-api-certificate",
      {
        domainName: "strapi.inflow-it-labs.tk",
        validation:
          aws_certificatemanager.CertificateValidation.fromDns(hostedZone),
      }
    );
  }
}
