import { Database, type SQLQueryBindings } from 'bun:sqlite';

class SQLError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SQLError';
    }
}

type DataTypesPrimitive = "TEXT" | "INTEGER" | "DECIMAL" | "BLOB" | "NULL";
type TableConstraints = "PRIMARY KEY" | "UNIQUE" | "NOT NULL" | "CHECK" | "FOREIGN KEY" | "AUTOINCREMENT";
type DataTypes = DataTypesPrimitive | `${DataTypesPrimitive} ${TableConstraints}` | `${DataTypesPrimitive} ${TableConstraints} ${TableConstraints}`;

type TableSchema<T> = {
    [K in keyof T]: {
        name: K;
        type: DataTypes;
        foreignKey?: string;
    };
}[keyof T][];

export default class DbConnector<
    TableNames extends string, 
    Schema extends Record<TableNames, Record<string, unknown>>
> {

    private db: Database;
    private tableNames: Set<TableNames>;

    /**
     * Creates a new SQLite database connection
     * @param dbName Path to SQLite database file or ":memory:" for in-memory database
     * @param tableNames Array of table names that will be used with this connection
     * @throws {SQLError} If database cannot be opened or initialized
     * 
     * @example
     * type DatabaseSchema {
     *  UserTable: {
     *    userID: string,
     *    archived: boolean;
     *  },
     *  UserSessions: {
     *    userID: string,
     *    sessionCounter: number, 
     *  }
     * }
     * 
     * const database = new Database()
     */
    constructor(dbName: `${string}.SQLite` | ":memory:", tableNames: TableNames[]) {
        this.tableNames = new Set(tableNames);
        try {
            this.db = new Database(dbName, { create: true, strict: true });
            this.db.exec("PRAGMA journal_mode = WAL;");
            this.setForeignKeyMode("OFF");
        } catch (error: any) {
            if (error.code === "SQLITE_CANTOPEN") {
                throw new SQLError(`Unable to access database: "${dbName}". ${error}`);
            }
            throw new SQLError(`Database error: ${error}`);
        }

        if (this.db === undefined) {
            throw new SQLError('Failed to construct database.');
        }
    }

    /**
     * Sets the SQLite foreign key enforcement mode
     * @param mode "ON" to enable foreign key constraints, "OFF" to disable
     */
    public setForeignKeyMode(mode: "ON" | "OFF"): void {
        this.db.exec(`PRAGMA foreign_keys = ${mode};`);
    }

    
    /**
     * Getter for the underlying Bun Database. Useful if you want to excecute your own queries.
     *
     * @public
     * @readonly
     * @type {Database}
     */
    public get database(): Database {
        return this.db;
    }

    /**
     * Retrieves the schema information for a table
     * @param tableName Name of the table to get schema for
     * @returns Array of column information from PRAGMA table_info
     */
    public getSchema(tableName: TableNames) { // TODO: Add proper typing for this
        return this.db.query(`PRAGMA table_info(${tableName})`).all();
    }

    /**
     * Validates if a table name exists in the allowed set
     * @param tableName Name of the table to validate
     * @throws {Error} If table name is not in the allowed set
     */
    public validateTableName(tableName: string): asserts tableName is TableNames {
        if (!this.tableNames.has(tableName as TableNames)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }
    }

    /**
     * Creates a new table if it doesn't exist
     * @param tableName Name of the table to create
     * @param columns Array of column definitions with types and constraints
     * @throws {SQLError} If table creation fails
     */
    createTable<TableName extends TableNames>(
        tableName: TableName, 
        columns: TableSchema<Schema[TableName]>
    ): void {
        this.validateTableName(tableName);
        const foreignKeys: string[] = [];
        const columnsDefinition: string = columns
            .map((col) => {
                let columnDef = `${String(col.name)} ${col.type}`;
                if (col.foreignKey) {
                    foreignKeys.push(`FOREIGN KEY(${String(col.name)}) ${col.foreignKey}`);
                }
                return columnDef;
            })
            .concat(foreignKeys)
            .join(", ");

        try {
            const createTableQuery: string = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnsDefinition})`;
            this.db.run(createTableQuery);
        } catch (error) {
            throw new SQLError(`Error creating table ${tableName}: ${error}`);
        }
    }

    /**
     * Inserts a new record into a table
     * @param tableName Name of the target table
     * @param values Object containing column-value pairs to insert
     * @throws {Error} If table name is invalid or insert fails
     */
    insertRecord<TableName extends TableNames>(
        tableName: TableName, 
        values: Partial<Schema[TableName]>
    ): void {
        this.validateTableName(tableName);
        const columns: string = Object.keys(values).join(", ");
        const placeholders: string = Object.keys(values)
            .map(() => "?")
            .join(", ");
        const insertQuery: string = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;

        const insertValues: any[] = Object.values(values);
        this.db.run(insertQuery, ...insertValues);
    }

    /**
     * Inserts or updates a record based on a conflict column
     * @param tableName Name of the target table
     * @param values Object containing column-value pairs to upsert
     * @param conflictColumn Column to check for conflicts
     * @throws {Error} If table name is invalid or upsert fails
     */
    upsertRecord<TableName extends TableNames>(
        tableName: TableName,
        values: Partial<Schema[TableName]>,
        conflictColumn: keyof Schema[TableName] & string,
    ): void {
        this.validateTableName(tableName);
        const columns: string = Object.keys(values).join(", ");
        const placeholders: string = Object.keys(values)
            .map(() => "?")
            .join(", ");

        // Build the update clause for the fields (to update them if a conflict happens)
        const updateClause: string = Object.keys(values)
            .map((col) => `${col} = excluded.${col}`)
            .join(", ");

        // On conflict, update the values for the conflicting column
        const upsertQuery: string = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})
            ON CONFLICT(${conflictColumn.toString()}) DO UPDATE SET ${updateClause}`;

        const upsertValues: any[] = Object.values(values);
        this.db.run(upsertQuery, ...upsertValues);
    }

    /**
     * Retrieves all records from a table
     * @param tableName Name of the table to query
     * @param limit Optional maximum number of records to return
     * @returns Array of records matching the table's schema
     * @throws {Error} If table name is invalid
     */
    fetchAllRecords<TableName extends TableNames>(tableName: TableName, limit?: number): Schema[TableName][] {
        this.validateTableName(tableName);
        let fetchQuery: string = `SELECT * FROM ${tableName}`;
        if (limit) {
            fetchQuery += ` LIMIT ?`;
            const results = this.db.query(fetchQuery).all(limit);
            return results as Schema[TableName][];
        } else {
            const results = this.db.query(fetchQuery).all();
            return results as Schema[TableName][];
        }
    }

    /**
     * Fetches records matching a WHERE condition
     * @param tableName Name of the table to query
     * @param condition SQL WHERE clause
     * @param values Array of values to bind to the query
     * @returns Array of records matching the condition
     * @throws {Error} If table name is invalid
     */
    fetchRecordsWithCondition<TableName extends TableNames>(
        tableName: TableName,
        condition: string,
        values: SQLQueryBindings[]
    ): Schema[TableName][] {
        this.validateTableName(tableName);
        const fetchQuery: string = `SELECT * FROM ${tableName} WHERE ${condition}`;
        const results: unknown[] = this.db.query(fetchQuery).all(...values);
        return results as Schema[TableName][];
    }

    /**
     * Deletes a table from the database
     * @param tableName Name of the table to delete
     * @throws {SQLError} If table deletion fails
     */
    deleteTable(tableName: TableNames): void {
        this.validateTableName(tableName);
        try {
            const schemaQuery: string = `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`;
            const result = this.db.query(schemaQuery).all();

            if (result.length > 0) {
                const dropQuery: string = `DROP TABLE ${tableName}`;
                this.db.run(dropQuery);
            } else {
                console.warn(`Table ${tableName} does not exist.`);
            }
        } catch (error) {
            throw new SQLError(`Error deleting table ${tableName}: ${error}`);
        }
    }

    /**
     * Safely closes the database connection
     */
    closeConnection(): void {
        this.db.close(false);
    }
}