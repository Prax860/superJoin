"""Thin Supabase client wrapper."""
from functools import lru_cache

from supabase import Client, create_client

from app import config


@lru_cache(maxsize=1)
def get_client() -> Client:
    config.require_env()
    return create_client(config.SUPABASE_URL, config.SUPABASE_KEY)
