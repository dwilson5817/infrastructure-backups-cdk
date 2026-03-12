import hvac
import os
import json
import boto3
import requests

def get_vault_client():
    vault_addr = os.environ.get('VAULT_ADDR')
    aws_region = os.environ.get('AWS_REGION')

    client = hvac.Client(url=vault_addr)

    session = boto3.Session()
    credentials = session.get_credentials()

    client.auth.aws.iam_login(
        access_key=credentials.access_key,
        secret_key=credentials.secret_key,
        session_token=credentials.token,
        role='backups-roles-anywhere-lambda',
        region=aws_region,
    )

    return client


def handler(event, context):
    get_vault_client().secrets.kv.v2.create_or_update_secret(
      **event,
    )

    return { "message": "OK" }
