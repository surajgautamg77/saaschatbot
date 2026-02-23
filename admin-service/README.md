# RhysleyBot

This document provides instructions on how to set up and run the RhysleyBot application for local development.

## Prerequisites

*   **Node.js**: v18 or later recommended.
*   **npm**: v8 or later (comes with Node.js).
*   **PostgreSQL**: A running instance of PostgreSQL.

## Getting Started

Follow these steps to get your development environment set up.

### 1. Install Dependencies

First, clone the repository to your local machine. Then, navigate to the project's root directory and install the dependencies for all workspaces (`server`, `admin`, and `client`):

```bash
npm install
```

### 2. Configure Environment Variables

The server requires a `.env` file in the root of the project to store sensitive configuration, such as database credentials and API keys.

Create a file named `.env` in the project root and add the following content.

```env
# PostgreSQL Database URL
# Replace USER, PASSWORD, HOST, PORT, and DATABASE with your actual credentials.
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"

# JSON Web Token Secret for authentication
JWT_SECRET="YOUR_SUPER_SECRET_JWT_KEY"

# API Keys for AI Services (e.g., Google Gemini or OpenAI)
# Add the API keys for the services you intend to use.
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
OPENAI_API_KEY="YOUR_OPENAI_API_KEY"

# Other server configurations
SERVER_PORT=3001
```

**Important Security Note**: The `.env` file should **never** be committed to version control. Ensure your `.gitignore` file includes `.env` to prevent accidentally exposing your secrets.

### 3. Set Up the Database

Before you can run the application, you need to prepare your PostgreSQL database.

1.  **Enable the `vector` Extension**:
    Prisma uses the `pgvector` extension for handling vector embeddings for AI features. Connect to your PostgreSQL database (the one specified in `DATABASE_URL`) and run the following SQL command:
    ```sql
    CREATE EXTENSION IF NOT EXISTS vector;
    ```

2.  **Run Database Migrations**:
    Now, apply the database schema to your instance. The `prisma` command needs to be run from the `server` workspace.

    ```bash
    cd server
    npx prisma migrate dev
    cd ..
    ```
    This command will create all the necessary tables in your database based on the schema in `server/prisma/schema.prisma`.

### 4. Run the Application

You can run all services (`server`, `admin`, `client`) concurrently using the `dev` script in the root `package.json`:

```bash
npm run dev
```

This will start the entire application stack:
*   The **server** on `http://localhost:3001`
*   The **admin dashboard** on `http://localhost:5173`
*   The **client widget** preview on `http://localhost:5174`

You can now access the admin dashboard at `http://localhost:5173` to get started.

## Build for Production

To create production builds of the applications, you can use the following commands:

*   **Build all applications:**

    ```bash
    npm run build
    ```

*   **Build a specific application:**

    ```bash
    npm run build -w @rhysley/server
    npm run build -w @rhysley/admin
    npm run build -w @rhysley/client
    ```

    The build artifacts will be located in the `dist` folder of each package.

## Running in Production

To run the entire RhysleyBot application stack in a production-like optimized way on your local machine, follow these steps:

**1. Build All Applications**

First, ensure all applications (server, admin, client) are built for production. Run this command from the **root directory** of the project:

```bash
npm run build
```

**2. Start the Backend Server**

Open your first terminal window, navigate to the `server` directory, and start the backend server:

```bash
cd server
npm start
```
The backend API will typically be available at `http://localhost:3001`.

**3. Serve the Admin Panel**

Open a second terminal window, navigate to the `admin` directory, and serve the built admin panel static files:

```bash
cd admin
npm run preview
```
The admin panel will typically be available at `http://localhost:5173/admin/`. Check your terminal for the exact address.

**4. Serve the Client Widget**

Open a third terminal window, navigate to the `client` directory, and serve the built client widget static files:

```bash
cd client
npm run preview
```
The client widget will typically be available at `http://localhost:5174`. Check your terminal for the exact address.

**Important Considerations for True Production Environments:**

For a live production environment, you would typically:
*   Use a dedicated web server (like Nginx, Apache, or Caddy) to serve the static files from the `admin/dist` and `client/dist` directories.
*   The Node.js backend server (`npm start` from the `server` directory) would run as a separate process, often managed by a process manager (e.g., PM2) or containerization (e.g., Docker).
*   Ensure all necessary environment variables are securely configured for the production deployment.

## Running in Production with PM2

[PM2](https://pm2.keymetrics.io/) is a production process manager for Node.js applications that helps you manage and keep your application online.

**1. Install PM2**

If you don't have PM2 installed, you can install it globally:

```bash
npm install pm2 -g
```

**2. Build All Applications**

First, ensure all applications are built for production. Run this from the **root directory**:

```bash
npm run build
```

**3. Start Applications with PM2**

From the **root directory** of the project, run the following commands to start each part of the application under PM2:

*   **Start the Backend Server:**
    ```bash
    pm2 start server/dist/index.js --name rhysley-server --node-args="--require tsconfig-paths/register"
    ```

*   **Serve the Admin Panel:**
    ```bash
    pm2 serve admin/dist --name rhysley-admin --spa --port 5173
    ```
    **Note:** This serves the admin panel at the root of port 5173 (e.g., `http://localhost:5173/`). Because the admin application is built to run under a `/admin/` path, you will need a reverse proxy (like Nginx) to correctly route requests. For example, you would configure Nginx to route traffic from `http://your-domain/admin/` to `http://localhost:5173/`.

*   **Serve the Client Widget:**
    ```bash
    pm2 serve client/dist --name rhysley-client --port 5174
    ```

**4. Managing Applications with PM2**

Here are some common commands to manage your applications:

*   **List all running applications:**
    ```bash
    pm2 list
    ```

*   **View logs for a specific application:**
    ```bash
    pm2 logs rhysley-server
    ```

*   **Stop an application:**
    ```bash
    pm2 stop rhysley-server
    ```

*   **Restart an application:**
    ```bash
    pm2 restart rhysley-server
    ```

*   **Delete an application from PM2's list:**
    ```bash
    pm2 delete rhysley-server
    ```

This setup will run your backend server and serve your frontend applications as background processes, automatically restarting them if they crash.


uvicorn app.main:app --host 0.0.0.0 --port 8001