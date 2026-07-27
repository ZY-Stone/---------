"""API response formatter — camelCase conversion + field alignment"""
import re

def to_camel(s: str) -> str:
    """snake_case → camelCase"""
    parts = s.split('_')
    return parts[0] + ''.join(p.capitalize() for p in parts[1:])

def camelize(obj):
    """Recursively convert all dict keys to camelCase"""
    if isinstance(obj, dict):
        return {to_camel(k): camelize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [camelize(i) for i in obj]
    return obj
