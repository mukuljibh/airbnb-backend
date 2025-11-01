**Project: Airbnb-like Booking Platform (name tentative)\
Server powered by: Node.js, Express, and MongoDB**

### Dev Notes

**Library Notes**

-   All libraries in this project are intentionally chosen for
    > scalability and cost optimization, which fits our current stage.
    > The server code is currently not tested on a public-facing
    > environment. While libraries may be revisited or changed if they
    > fall short in the future, it is likely that this selection will
    > continue to work efficiently for our use case.

-   Libraries may be swapped or upgraded as the system scales and new
    > requirements emerge.

**Future Notes**

-   All future important parts of the server should be documented here.

-   Everyone working on this project is requested to **add any important
    > parts they implement on their side**, to make future development
    > easier and help everyone understand the server architecture.

-   Currently, we use a **route → middleware → controller → validation**
    > structure with separate folders.

-   Later, we plan to shift to a **feature-based layered architecture**,
    > where each feature (e.g., Reservations, Properties, Payments) will
    > have its own folder containing:

    -   Controllers

    -   Routes

    -   Middleware

    -   Services

    -   Repositories

    -   Validations

    -   Utilities

-   This approach ensures **modularity, scalability, and a clean
    > separation of concerns** as the project grows. The architecture
    > has been implemented in code and is currently under development in
    > the staging branch under v2 folder. It does not yet contain the
    > full code as in main.

**Error Handling (express-async-errors)**

-   Patched the server with import \"express-async-errors\" in
    > server.ts.

-   All controllers are now automatically wrapped in try/catch.

-   No need to manually use try/catch blocks or call next(error) inside
    > controllers.

-   Existing code will continue to work, but please migrate where
    > possible.

-   For early exits, instead of return next(\...), simply throw new
    > ApiError(\...); middleware will handle it.

-   Use try/catch only when handling custom errors.

**Uploads Module (Cloudinary Utilities)**\
Three main methods are available to manage and sync files with
Cloudinary:

1.  **releaseUploadResources** -- Cleans up files from Cloudinary.

2.  **confirmUploadResources** -- Confirms a file and stores it
    > permanently in Cloudinary.

    -   ⚠️ Files are not permanent until this method is called.

3.  **syncAndDeleteFiles** -- Confirms and releases files in bulk.

    -   Provide the existing file array and the new file array.

    -   Automatically handles the diff (confirming or releasing files).

⚠️ **Important:**

-   If these utilities are not used correctly, files may misbehave on
    > the client side.

-   Under the hood, MongoDB is used to store temporary file URLs:

    -   These are kept until confirmed.

    -   If not confirmed within 30 minutes of creation, they are
        > discarded permanently.

-   A scheduler runs every 30 minutes in the background to wipe expired
    > temporary files from Cloudinary.

**MongoDB Utilities**

1.  **withMongoTransaction** -- Wraps server code in a MongoDB
    > transaction.

2.  **validateObjectId** -- Validates any MongoDB ID (string or
    > ObjectId).

    -   If invalid → throws an error.

    -   If valid → returns the ObjectId instance.

    -   For TypeScript: import MongoObjectId when you need to type a key
        > as a MongoDB ObjectId.

**Background Jobs (Agenda)**

-   We use Agenda for automatic payment processing and job scheduling.

-   Agenda persists jobs in MongoDB for durability.

-   Supports exponential backoff retry mechanisms for reliability.

-   Please review and consider Agenda jobs when adding features that
    > require background tasks.
