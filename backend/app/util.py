import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import Setting

DEFAULT_RUBRIC = [["الالتزام والحضور", "Commitment & attendance"], ["التطبيق العملي للسلوكيات", "Practical application of behaviors"],
                  ["التأمل والوعي الذاتي", "Reflection & self-awareness"], ["المشاركة والتفاعل", "Participation & engagement"],
                  ["أثر التغيير في العلاقات الثلاث", "Impact on the three relationships"]]
DEFAULT_GRADES = [{"min": 90, "t": ["ممتاز", "Excellent"]}, {"min": 80, "t": ["جيد جدًا", "Very good"]}, {"min": 70, "t": ["جيد", "Good"]},
                  {"min": 60, "t": ["مقبول", "Pass"]}, {"min": 0, "t": ["غير مجتاز", "Not passed"]}]


def parse_id(raw: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(raw))
    except ValueError:
        raise HTTPException(status_code=404, detail={"code": "not_found"}) from None


def get_setting(db: Session, key: str, default):
    row = db.get(Setting, key)
    return row.value.get("v", default) if row else default


def put_setting(db: Session, key: str, value) -> None:
    row = db.get(Setting, key)
    if row:
        row.value = {"v": value}
    else:
        db.add(Setting(key=key, value={"v": value}))


def rubric(db: Session) -> list:
    return get_setting(db, "rubric", DEFAULT_RUBRIC)


def grade_label(db: Session, final: float | None) -> list[str]:
    if final is None:
        return ["—", "—"]
    for g in sorted(get_setting(db, "grades", DEFAULT_GRADES), key=lambda g: -g["min"]):
        if final >= g["min"]:
            return g["t"]
    return ["—", "—"]
