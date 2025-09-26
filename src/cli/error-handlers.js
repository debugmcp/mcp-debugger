export function setupErrorHandlers(dependencies) {
    const { logger, exitProcess = process.exit } = dependencies;
    process.on('uncaughtException', (err, origin) => {
        logger.error(`[Server UNCAUGHT_EXCEPTION] Origin: ${origin}`, {
            errorName: err.name,
            errorMessage: err.message,
            errorStack: err.stack
        });
        exitProcess(1);
    });
    process.on('unhandledRejection', (reason, promise) => {
        logger.error('[Server UNHANDLED_REJECTION] Reason:', { reason });
        logger.error('[Server UNHANDLED_REJECTION] Promise:', { promise });
        exitProcess(1);
    });
}
//# sourceMappingURL=error-handlers.js.map