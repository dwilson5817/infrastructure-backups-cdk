import hvac
import os
import json
import boto3
import requests

def get_vault_client():
    client = hvac.Client(url=os.environ.get('VAULT_ADDR'))

    session = boto3.Session()
    credentials = session.get_credentials()

    client.auth.aws.iam_login(
        access_key=credentials.access_key,
        secret_key=credentials.secret_key,
        session_token=credentials.token,
        role='backups-roles-anywhere-lambda'
    )

    return client


def handler(event, context):
    get_vault_client().secrets.kv.v2.create_or_update_secret(
      **event,
    )

    return { "message": "OK" }
