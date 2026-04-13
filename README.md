# Application Review System

A professional, AI-assisted screening tool designed to streamline the evaluation of internship and volunteer applications. By leveraging local Large Language Models (LLMs) via Ollama, the system provides privacy-focused, automated screening against customizable position profiles and weighted criteria. This is designed to supplement, not replace, manual, personal review of each application by the hiring manager.

## Project Scope

The Application Review System serves as a bridge between high-volume application intake and informed decision-making. It is built to support the initial screening phase by extracting key qualifications from resumes and comparing them against the specific needs of a department or position.

### Core Features

- **Position Profile Management**: Define and store detailed position requirements. Each profile allows for the specification of screening criteria (e.g., technical skills, availability, education) and the assignment of relative weights to prioritize different qualifications.
- **AI-Powered Evaluation**: Integration with local LLMs (via Ollama) allows for sophisticated semantic analysis of applications. The system evaluates how well an applicant's experience aligns with the weighted criteria of a profile.
- **Automated PDF Parsing**: Integrated support for PDF resumes enables the system to extract text directly from documents, reducing the need for manual copy-pasting or data entry.
- **Batch Processing Workflow**: Manage an applicant queue through a master-detail interface. Users can evaluate applicants sequentially, review AI findings, and manage the screening process from a single dashboard.
- **Apex Modern Interface**: Built using the Apex Modern design system, the interface emphasizes structure, professional clarity, and accessibility. It utilizes a stepped-surface layering system for high-contrast visual hierarchy.
- **Local-First Architecture**: Designed for privacy and security, the application processes all data on-site. Applicant resumes and evaluations never leave the local environment, ensuring compliance with institutional data standards.

## Technology Stack

- **Backend**: Python 3.13+, FastAPI, Pydantic
- **Frontend**: Vanilla JavaScript, Vanilla CSS (Apex Modern), HTML5
- **AI Integration**: Ollama (Local LLM API)
- **PDF Processing**: pdfplumber
- **Package Management**: uv
- **Containerization**: Docker, Docker Compose

## Installation and Setup

### Prerequisites

- Python 3.13 or higher
- [Ollama](https://ollama.com/) installed and running locally
- [uv](https://github.com/astral-sh/uv) (recommended) or pip

### Local Development

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/Town-of-Apex/Application-Review.git
    cd Application-Review
    ```

2.  **Install dependencies**:

    ```bash
    uv sync
    ```

3.  **Ensure Ollama is running**:
    Verify Ollama is accessible at `http://localhost:11434`. Pull a model for evaluation (e.g., `ollama pull llama3`).

4.  **Launch the application**:
    ```bash
    uv run main.py
    ```
    The application will be accessible at `http://localhost:3000`.

### Docker Deployment

For server-based deployment, a Docker Compose configuration is provided:

1.  **Build and start the container**:

    ```bash
    docker-compose up -d
    ```

2.  **Configuration**:
    The container expects Ollama to be running on the host machine. The default configuration uses `host.docker.internal` to connect.

## Development Roadmap

The following features and optimizations are planned for future releases of the Application Review System.

### Feature Enhancements

- **Multi-Position Evaluation**: Allow users to run the same evaluation against multiple position profiles, generating a best-fit internship and score for each applicant.
- **Report Generation**: Export evaluation results to professional HTML, PDF, or CSV formats for internal distribution.
- **Advanced PDF Analysis**: Improve extraction capabilities for complex document layouts, multi-column resumes, and embedded imagery.

### Optimizations

- **Local Caching**: Implement a local database (e.g., SQLite) to store processed resume text and historical evaluation results for faster retrieval.
- **Queue Concurrency**: Optimize the batch processing engine to handle background evaluations while the user interacts with the UI.

## License

This project is licensed under the MIT License.
