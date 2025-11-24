from flask import Flask

# Blueprints
from routes.course_route import course_bp  # /course
from routes.submission_route import submission_bp  # /submission
from routes.plagiarism_route import plagiarism_bp  # /plagiarism

# Flask app
app = Flask(__name__)

# Register all blueprints
app.register_blueprint(course_bp)
app.register_blueprint(submission_bp)
app.register_blueprint(plagiarism_bp)

# Run server
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
