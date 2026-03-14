import logging
import os

import boto3
import hvac
from hvac.exceptions import InvalidPath


LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)


def _build_physical_resource_id(mount_point, path):
    return "vault-secret:{0}:{1}".format(mount_point, path)


def _get_vault_client():
    vault_addr = os.environ["VAULT_ADDR"]
    vault_role = os.environ["VAULT_ROLE"]
    aws_region = os.environ["AWS_REGION"]

    session = boto3.Session()
    credentials = session.get_credentials()
    frozen_credentials = credentials.get_frozen_credentials()

    client = hvac.Client(url=vault_addr)
    client.auth.aws.iam_login(
        access_key=frozen_credentials.access_key,
        secret_key=frozen_credentials.secret_key,
        session_token=frozen_credentials.token,
        role=vault_role,
        region=aws_region,
    )

    if not client.is_authenticated():
        raise RuntimeError("Vault authentication failed")

    return client


def _write_secret(client, mount_point, path, secret):
    client.secrets.kv.v2.create_or_update_secret(
        mount_point=mount_point,
        path=path,
        secret={
            "backups_bucket": secret["backupsBucket"],
            "trust_anchor_arn": secret["trustAnchorArn"],
            "profile_arn": secret["profileArn"],
            "role_arn": secret["roleArn"],
        },
    )


def _delete_secret(client, mount_point, path):
    try:
        client.secrets.kv.v2.delete_metadata_and_all_versions(
            mount_point=mount_point,
            path=path,
        )
    except InvalidPath:
        LOGGER.info(
            "Vault secret already absent; treating delete as success for mountPoint=%s path=%s",
            mount_point,
            path,
        )


def handler(event, context):
    request_type = event["RequestType"]
    resource_properties = event.get("ResourceProperties", {})
    old_resource_properties = event.get("OldResourceProperties", {})

    mount_point = resource_properties["mountPoint"]
    path = resource_properties["path"]
    secret = resource_properties["secret"]

    physical_resource_id = _build_physical_resource_id(mount_point, path)

    LOGGER.info(
        "Handling Vault secret custom resource event: requestType=%s mountPoint=%s path=%s",
        request_type,
        mount_point,
        path,
    )

    client = _get_vault_client()

    if request_type == "Create":
        _write_secret(client, mount_point, path, secret)
        return {
            "PhysicalResourceId": physical_resource_id,
        }

    if request_type == "Update":
        _write_secret(client, mount_point, path, secret)

        old_mount_point = old_resource_properties.get("mountPoint")
        old_path = old_resource_properties.get("path")

        if old_mount_point and old_path:
            if old_mount_point != mount_point or old_path != path:
                LOGGER.info(
                    "Deleting previous Vault secret after path change: oldMountPoint=%s oldPath=%s",
                    old_mount_point,
                    old_path,
                )
                _delete_secret(client, old_mount_point, old_path)

        return {
            "PhysicalResourceId": physical_resource_id,
        }

    if request_type == "Delete":
        delete_mount_point = resource_properties.get("mountPoint") or old_resource_properties.get("mountPoint")
        delete_path = resource_properties.get("path") or old_resource_properties.get("path")

        if delete_mount_point and delete_path:
            _delete_secret(client, delete_mount_point, delete_path)

        return {
            "PhysicalResourceId": event.get("PhysicalResourceId", physical_resource_id),
        }

    raise ValueError("Unsupported RequestType: {0}".format(request_type))
