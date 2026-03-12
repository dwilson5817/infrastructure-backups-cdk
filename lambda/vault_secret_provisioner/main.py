import hvac
import os
import json
import boto3
import requests


def handler(event, context):
    session = boto3.Session()
    credentials = session.get_credentials()

    client = hvac.Client()
    client.auth.aws.iam_login(
        access_key=credentials.access_key,
        secret_key=credentials.secret_key,
        session_token=credentials.token,
        role=os.environ.get('VAULT_ROLE'),
        region=os.environ.get('AWS_REGION'),
    )

    return client.secrets.kv.v2.create_or_update_secret(
        **event,
    )
