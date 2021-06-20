import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as assets from '@aws-cdk/aws-s3-assets';
import * as path from 'path'

export class CdkEc2DebianStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const vpc_id = this.node.tryGetContext('vpc_id')
    const ami_id = this.node.tryGetContext('ami_id')
    const key_name = this.node.tryGetContext('key_name')
    const securitygroup_id = this.node.tryGetContext('securitygroup_id')
    
    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', { vpcId: vpc_id })
    
    const python_asset = new assets.Asset(this, 'PythonAsset', {
      path: path.join(__dirname, '..', 'userdata', 'tornado_server.py'),
    })
    const service_asset = new assets.Asset(this, 'ServiceAsset', {
      path: path.join(__dirname, '..', 'userdata', 'tornado.service'),
    })
    const agent_asset = new assets.Asset(this, 'AgnetAsset', {
      path: path.join(__dirname, '..', 'userdata', 'cloudwatch-agent-config.json'),
    })
    
    const userData = ec2.UserData.forLinux()
    userData.addCommands('apt update')
    userData.addCommands('apt upgrade -y')
    userData.addCommands('apt install unzip -y')
    userData.addCommands('apt install python3-pip -y')
    userData.addCommands('curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"')
    userData.addCommands('unzip awscliv2.zip')
    userData.addCommands('./aws/install')
    userData.addCommands('wget https://s3.amazonaws.com/amazoncloudwatch-agent/debian/amd64/latest/amazon-cloudwatch-agent.deb')
    userData.addCommands('dpkg -i -E ./amazon-cloudwatch-agent.deb')
    userData.addCommands(
      cdk.Fn.join(" ", [
        'aws s3api get-object --bucket', 
        python_asset.s3BucketName, 
        '--key', 
        python_asset.s3ObjectKey, 
        '/opt/tornado_server.py'
      ])
    )
    userData.addCommands(
      cdk.Fn.join(" ", [
        'aws s3api get-object --bucket', 
        service_asset.s3BucketName, 
        '--key', 
        service_asset.s3ObjectKey, 
        '/etc/systemd/system/tornado.service'
      ])
    )
    userData.addCommands(
      cdk.Fn.join(" ", [
        'aws s3api get-object --bucket', 
        agent_asset.s3BucketName, 
        '--key', 
        agent_asset.s3ObjectKey, 
        '/opt/aws/amazon-cloudwatch-agent/bin/config.json'
      ])
    )
    userData.addCommands('python3 -m pip install tornado')
    userData.addCommands('chmod 644 /etc/systemd/system/tornado.service')
    userData.addCommands('systemctl daemon-reload')
    userData.addCommands('systemctl enable tornado.service')
    userData.addCommands('systemctl start tornado.service')
    userData.addCommands('/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/bin/config.json -s')

    const linux = ec2.MachineImage.genericLinux({
      'ap-northeast-1': ami_id
    })
    
    const role = new iam.Role(this, "Role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "CloudWatchAgentServerPolicy",
        )
      ]
    })

    const instance = new ec2.Instance(this, 'Instance', {
      vpc: vpc,
      machineImage: linux,
      instanceType: new ec2.InstanceType('t3.nano'),
      role: role,
      keyName: key_name,
      userData: userData,
      securityGroup: ec2.SecurityGroup.fromSecurityGroupId(this, 'Ec2SecurityGrp', securitygroup_id)
    })
    
    python_asset.grantRead( instance.role )
    service_asset.grantRead( instance.role )
    agent_asset.grantRead( instance.role )
    
    new cdk.CfnOutput(this, 'PrivateIp', { value: instance.instancePrivateIp })
    new cdk.CfnOutput(this, 'PublicIp', { value: instance.instancePublicIp })

  }
}
