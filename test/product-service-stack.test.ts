import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ProductServiceStack } from '../lib/product-service/product-service-stack';

describe('ProductServiceStack', () => {
  test('creates products list and product-by-id endpoints', () => {
    const app = new cdk.App();
    const stack = new ProductServiceStack(app, 'ProductServiceStackTest');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'getProductsList',
      Handler: 'get-products-list-handler.main',
      Runtime: 'nodejs20.x',
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'getProductsById',
      Handler: 'get-products-by-id-handler.main',
      Runtime: 'nodejs20.x',
    });

    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'products',
    });

    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: '{productId}',
    });

    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'GET',
    });
  });
});
