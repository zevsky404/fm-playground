from config import db
from flask_login import UserMixin
from sqlalchemy.sql import func


class Data(db.Model):
    __tablename__ = "data"
    id = db.Column(db.Integer, primary_key=True)
    time = db.Column(db.DateTime())
    session_id = db.Column(db.String())
    parent = db.Column(db.Integer)
    check_type = db.Column(db.String())
    permalink = db.Column(db.String())
    meta = db.Column(db.String())
    reference = db.Column(db.String(), nullable=True)

    code_id = db.Column(db.Integer, db.ForeignKey("code.id"), nullable=False)
    user_id = db.Column(db.String, db.ForeignKey("users.id"), nullable=True)


class User(db.Model, UserMixin):
    __tablename__ = "users"
    id = db.Column(db.String, primary_key=True, unique=True)
    email = db.Column(db.String())

    data = db.relationship("Data", backref="users", lazy=True)

    @staticmethod
    def get(user_id):
        user = User.query.filter_by(id=user_id).first()
        return user


class Code(db.Model):
    __tablename__ = "code"
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String())

    data = db.relationship("Data", backref="code", lazy=True)


class DataDetails(db.Model):
    __tablename__ = "data_details"
    id = db.Column(db.Integer, primary_key=True)
    data_id = db.Column(
        db.Integer, db.ForeignKey("data.id"), nullable=False, unique=True
    )
    title = db.Column(db.String(), nullable=True, default="Untitled")
    # Store tags as JSON string (e.g., ["safety", "invariant"]) for simplicity
    tags = db.Column(db.String(), nullable=True)
    pinned = db.Column(db.Boolean(), nullable=False, default=False)
    created_at = db.Column(db.DateTime(), server_default=func.now())
    updated_at = db.Column(
        db.DateTime(), server_default=func.now(), onupdate=func.now()
    )

    # Optional: relationship back to Data if needed later
    data = db.relationship("Data", backref=db.backref("details", uselist=False))


class ResultLogs(db.Model):
    __tablename__ = "result"
    id = db.Column(db.Integer, primary_key=True)
    data_id = db.Column(db.Integer, db.ForeignKey("data.id"), nullable=False)
    timestamp = db.Column(db.DateTime(), server_default=func.now())
    result = db.Column(db.String(), nullable=False)

    data = db.relationship("Data", backref="result_logs")
