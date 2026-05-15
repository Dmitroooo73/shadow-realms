import os
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "http://127.0.0.1:9000")
PUBLIC_S3_URL = os.getenv("PUBLIC_S3_URL", "http://localhost:9000")
ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "shadow-realms")

s3_client = boto3.client(
    's3',
    endpoint_url=ENDPOINT_URL,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    config=boto3.session.Config(signature_version='s3v4'),
    region_name='us-east-1',
)

# Separate client for generating presigned URLs with the PUBLIC endpoint,
# so signatures remain valid when the browser hits localhost:9000.
s3_public_client = boto3.client(
    's3',
    endpoint_url=PUBLIC_S3_URL,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    config=boto3.session.Config(signature_version='s3v4'),
    region_name='us-east-1',
)


def init_s3_bucket():
    """Проверяет существование бакета и создаёт его при необходимости."""
    try:
        s3_client.head_bucket(Bucket=BUCKET_NAME)
    except ClientError as e:
        error_code = int(e.response['Error']['Code'])
        if error_code == 404:
            print(f"🛠️ Создаю бакет: {BUCKET_NAME}")
            s3_client.create_bucket(Bucket=BUCKET_NAME)
        else:
            print(f"❌ Ошибка проверки бакета: {e}")


init_s3_bucket()


def upload_image_to_s3(image_bytes: bytes, file_name: str) -> str | None:
    """Загружает байты PNG-картинки (сцены истории) в S3."""
    try:
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=file_name,
            Body=image_bytes,
            ContentType='image/png',
        )
        return file_name
    except ClientError as e:
        print(f"❌ Ошибка загрузки в S3: {e}")
        return None


def upload_file_to_s3(
    file_bytes: bytes,
    file_name: str,
    content_type: str = 'application/octet-stream',
) -> str | None:
    """
    Универсальная загрузка пользовательского файла в S3 (Лаба 3).
    Принимает произвольный content_type (image/jpeg, image/png и т.д.).
    """
    try:
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=file_name,
            Body=file_bytes,
            ContentType=content_type,
        )
        return file_name
    except ClientError as e:
        print(f"❌ Ошибка загрузки файла в S3: {e}")
        return None


def get_presigned_url(file_name: str, expires_in: int = 604800) -> str | None:
    """Генерирует временную ссылку на файл (по умолчанию на 7 дней — максимум SigV4)."""
    if not file_name:
        return None
    try:
        return s3_public_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': BUCKET_NAME, 'Key': file_name},
            ExpiresIn=expires_in,
        )
    except ClientError as e:
        print(f"❌ Ошибка генерации URL S3: {e}")
        return None


def delete_file_from_s3(file_name: str) -> bool:
    """
    Удаляет файл из S3 по ключу (Лаба 3).
    Возвращает True при успехе, False при ошибке.
    """
    if not file_name:
        return False
    try:
        s3_client.delete_object(Bucket=BUCKET_NAME, Key=file_name)
        return True
    except ClientError as e:
        print(f"❌ Ошибка удаления файла из S3: {e}")
        return False
