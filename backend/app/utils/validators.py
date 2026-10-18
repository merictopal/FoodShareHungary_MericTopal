"""Request-value parsing shared by several routes/services."""


def parse_int(value):
    """Whole numbers only (int or digit string); bools, floats with decimals and text are rejected."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str) and value.strip().lstrip('-').isdigit():
        return int(value.strip())
    return None


def parse_id(value):
    """A positive integer id, or None (non-numeric, zero, negative)."""
    number = parse_int(value)
    return number if number is not None and number > 0 else None
