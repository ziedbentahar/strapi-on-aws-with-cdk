import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import { ICertificate } from "aws-cdk-lib/aws-certificatemanager";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import {
  Cluster,
  ContainerImage,
  Secret as ecs_Secret,
} from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import {
  IApplicationLoadBalancer,
  ListenerAction,
  ListenerCondition,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { ISecret, Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export interface ECSServiceProps extends NestedStackProps {
  vpc: IVpc;
  dbSecret: ISecret;
  certificate: ICertificate;
  dbName: string;
  dbHostname: string;
  dbPort: string;
  applicationName: string;
  authorizedIPsForAdminAccess: string[];
}

export class ECSService extends NestedStack {
  public readonly loadBalancer: IApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props?: ECSServiceProps) {
    super(scope, id, props);

    const {
      vpc,
      dbSecret,
      dbHostname,
      dbName,
      dbPort,
      certificate,
      applicationName,
      authorizedIPsForAdminAccess,
    } = props!;

    const strapiSecret = new Secret(this, "StrapiSecret", {
      secretName: `${applicationName}-strapi-secret`,

      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: "StrapiKey",
        excludePunctuation: true,
      },
    });

    const cluster = new Cluster(this, "Cluster", { vpc });
    const loadBalancedService = new ApplicationLoadBalancedFargateService(
      this,
      "FargateService",
      {
        cluster,
        taskImageOptions: {
          secrets: {
            ...this.getSecretsDefinition(dbSecret, strapiSecret),
          },
          image: ContainerImage.fromAsset("../cms"),
          containerPort: 1337,
          environment: {
            DATABASE_CLIENT: "postgres",
            DATABASE_HOST: dbHostname,
            DATABASE_PORT: dbPort,
            DATABASE_NAME: dbName,
            HOST: "0.0.0.0",
            PORT: "1337",
          },
        },
        certificate,
      }
    );

    const policyStatement = new PolicyStatement({
      resources: [dbSecret.secretFullArn!, strapiSecret.secretFullArn!],
      actions: ["secretsmanager:GetSecretValue"],
    });

    loadBalancedService.taskDefinition.addToExecutionRolePolicy(
      policyStatement
    );

    this.restricAccessToAdmin(loadBalancedService, authorizedIPsForAdminAccess);

    this.loadBalancer = loadBalancedService.loadBalancer;
  }

  private getSecretsDefinition(dbSecret: ISecret, strapiSecret: ISecret) {
    return {
      DATABASE_USERNAME: ecs_Secret.fromSecretsManager(dbSecret, "username"),
      DATABASE_PASSWORD: ecs_Secret.fromSecretsManager(dbSecret, "password"),
      JWT_SECRET: ecs_Secret.fromSecretsManager(strapiSecret, "StrapiKey"),
      APP_KEYS: ecs_Secret.fromSecretsManager(strapiSecret, "StrapiKey"),
      API_TOKEN_SALT: ecs_Secret.fromSecretsManager(strapiSecret, "StrapiKey"),
      ADMIN_JWT_SECRET: ecs_Secret.fromSecretsManager(
        strapiSecret,
        "StrapiKey"
      ),
    };
  }

  private restricAccessToAdmin(
    loadBalancedService: ApplicationLoadBalancedFargateService,
    authorizedIPsForAdminAccess: string[]
  ) {
    loadBalancedService.listener.addAction("accept", {
      priority: 1,
      conditions: [
        ListenerCondition.pathPatterns(["/admin/*"]),
        ListenerCondition.sourceIps(authorizedIPsForAdminAccess),
      ],
      action: ListenerAction.forward([loadBalancedService.targetGroup]),
    });

    loadBalancedService.listener.addAction("forbidden", {
      priority: 2,
      conditions: [ListenerCondition.pathPatterns(["/admin/*"])],
      action: ListenerAction.fixedResponse(403, {
        contentType: "text/html",
        messageBody: "Your IP address is not authorized",
      }),
    });
  }
}
