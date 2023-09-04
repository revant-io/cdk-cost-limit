import { Handler } from "aws-lambda";
import {
  DescribeInstanceAttributeCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";
import { GetProductsCommand, PricingClient } from "@aws-sdk/client-pricing";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { Revantios } from "../revantios";

type Event = {
  instanceId: string;
  address: string;
  budget: number;
};

const ec2Client = new EC2Client({});
const pricingClient = new PricingClient({ region: "us-east-1" });
const dynamoDBClient = new DynamoDBClient({});
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient);

const ENV_VARIABLE_REVANT_COST_TABLE_NAME = "REVANT_COST_TABLE_NAME";

const DYNAMODB_INCURRED_EXPENSES_RATE_ATTRIBUTE_NAME = "incurredExpensesRate";
const DYNAMODB_LAST_UPDATE_ATTRIBUTE_NAME = "updatedAt";

export const handler: Handler<Event> = async ({ instanceId, address }) => {
  const { InstanceType } = await ec2Client.send(
    new DescribeInstanceAttributeCommand({
      InstanceId: instanceId,
      Attribute: "instanceType",
    })
  );
  if (InstanceType === undefined) {
    console.log("Did not find the instance type");
    return;
  }

  const instanceType = InstanceType.Value;
  const { PriceList } = await pricingClient.send(
    new GetProductsCommand({
      ServiceCode: "AmazonEC2",
      Filters: [
        {
          Type: "TERM_MATCH",
          Field: "instanceType",
          Value: instanceType,
        },
        {
          Type: "TERM_MATCH",
          Field: "regionCode",
          Value: process.env.AWS_REGION,
        },
        {
          Type: "TERM_MATCH",
          Field: "operation",
          Value: "RunInstances",
        },
        {
          Type: "TERM_MATCH",
          Field: "tenancy",
          Value: "Shared",
        },
        {
          Type: "TERM_MATCH",
          Field: "capacityStatus",
          Value: "Used",
        },
      ],
    })
  );
  const prices = PriceList?.map((price) => {
    if (typeof price === "string") {
      return JSON.parse(price);
    }
    return price.deserializeJSON();
  });
  const extractedOnDemandPrice = Object.values(
    prices?.pop().terms.OnDemand
  ).pop() as {
    priceDimensions: Record<string, { pricePerUnit: Record<"USD", string> }>;
  };
  const hourlyOnDemandPriceUSD = Object.values(
    extractedOnDemandPrice.priceDimensions
  ).pop()?.pricePerUnit.USD;
  if (hourlyOnDemandPriceUSD === undefined) {
    console.log(
      `Did not find hourly on demand price for instance type: ${instanceType}`
    );
    return;
  }
  const hourlyOnDemandPriceRevantios = Revantios.fromUSD(
    hourlyOnDemandPriceUSD
  );
  console.log(hourlyOnDemandPriceRevantios.toString());

  const currentDate = new Date().toISOString();
  await dynamoDBDocumentClient.send(
    new UpdateCommand({
      TableName: process.env[ENV_VARIABLE_REVANT_COST_TABLE_NAME],
      Key: {
        PK: [currentDate.slice(0, 7), address].join("#"),
      },
      UpdateExpression: "ADD #R :newResourceExpensesRate SET #U = :updatedAt",
      ExpressionAttributeNames: {
        "#R": DYNAMODB_INCURRED_EXPENSES_RATE_ATTRIBUTE_NAME,
        "#U": DYNAMODB_LAST_UPDATE_ATTRIBUTE_NAME,
      },
      ExpressionAttributeValues: {
        ":newResourceExpensesRate": hourlyOnDemandPriceRevantios.toRate(3600),
        ":updatedAt": currentDate,
      },
    })
  );
};
