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
import jwt = require("jsonwebtoken");
// @ts-ignore no declaration available
import nodeBase64 = require("nodejs-base64-converter");

export interface ECSServiceStackProps extends NestedStackProps {
  vpc: IVpc;
  dbSecret: ISecret;
  certificate: ICertificate;
  dbName: string;
  dbHostname: string;
  dbPort: string;
  applicationName: string;
}

export class ECSServiceStack extends NestedStack {
  public readonly loadBalancer: IApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props?: ECSServiceStackProps) {
    super(scope, id, props);

    const {
      vpc,
      dbSecret,
      dbHostname,
      dbName,
      dbPort,
      certificate,
      applicationName,
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
            DATABASE_USERNAME: ecs_Secret.fromSecretsManager(
              dbSecret,
              "username"
            ),
            DATABASE_PASSWORD: ecs_Secret.fromSecretsManager(
              dbSecret,
              "password"
            ),
            JWT_SECRET: ecs_Secret.fromSecretsManager(
              strapiSecret,
              "StrapiKey"
            ),
            APP_KEYS: ecs_Secret.fromSecretsManager(strapiSecret, "StrapiKey"),
            API_TOKEN_SALT: ecs_Secret.fromSecretsManager(
              strapiSecret,
              "StrapiKey"
            ),
            ADMIN_JWT_SECRET: ecs_Secret.fromSecretsManager(
              strapiSecret,
              "StrapiKey"
            ),
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
      resources: [dbSecret.secretFullArn!],
      actions: ["secretsmanager:GetSecretValue"],
    });

    loadBalancedService.taskDefinition.addToExecutionRolePolicy(
      policyStatement
    );

    loadBalancedService.listener.addAction("/accept", {
      priority: 10,
      conditions: [
        ListenerCondition.pathPatterns(["/admin/*"]),
        ListenerCondition.sourceIps(["88.121.146.23/32"]),
      ],
      action: ListenerAction.forward([loadBalancedService.targetGroup]),
    });

    loadBalancedService.listener.addAction("/forbidden", {
      priority: 20,
      conditions: [ListenerCondition.pathPatterns(["/admin/*"])],
      action: ListenerAction.fixedResponse(403, {
        contentType: "text/html",
        messageBody: "Your ip address is not authorized",
      }),
    });

    this.loadBalancer = loadBalancedService.loadBalancer;
  }
}
