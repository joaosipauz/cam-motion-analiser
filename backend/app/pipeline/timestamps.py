"""Horario de inicio da gravacao (relogio de parede, sem fuso)."""
import re
from datetime import datetime

# 20261026_143200, 2026-10-26 14.32.00, 2026-10-26T14:32:00, ch01_20261026143200 ...
_FILENAME = re.compile(
    r"(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})[ T_\-]?(?:at )?(\d{2})[-_.:h]?(\d{2})[-_.:m]?(\d{2})")


def from_filename(name):
    m = _FILENAME.search(name)
    if not m:
        return None
    try:
        return datetime(*map(int, m.groups())).isoformat()
    except ValueError:
        return None


def from_metadata(creation_time):
    if not creation_time:
        return None
    try:
        dt = datetime.fromisoformat(creation_time.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.year < 2000:  # muitos DVRs gravam 1970/1904
        return None
    return dt.astimezone().replace(tzinfo=None).isoformat(timespec="seconds")


def detect(name, creation_time):
    """Retorna (iso, origem) ou (None, None)."""
    for source, value in (("arquivo", from_filename(name)),
                          ("metadados", from_metadata(creation_time))):
        if value:
            return value, source
    return None, None
