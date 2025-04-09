import { Database, type SQLQueryBindings } from 'bun:sqlite';

export class SQLError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SQLError';
    }
}

type SQLiteTypes = "TEXT" | "INTEGER" | "DECIMAL" | "BLOB" | "NULL";
type TableConstraints = "PRIMARY KEY" | "UNIQUE" | "NOT NULL" | "CHECK" | "FOREIGN KEY" | "AUTOINCREMENT";
export type DataTypes = SQLiteTypes | 
    `${SQLiteTypes} ${TableConstraints}` | 
    `${SQLiteTypes} ${TableConstraints} ${TableConstraints}` |
    `${SQLiteTypes} ${TableConstraints} ${TableConstraints} ${TableConstraints}` |
    `${SQLiteTypes} ${TableConstraints} ${TableConstraints} ${TableConstraints} ${TableConstraints}`;

type TableSchema<T> = {
    [K in keyof T]: {
        name: K;
        type: DataTypes;
        foreignKey?: string;
    };
}[keyof T][];

type OutputSchema<Columns> = {
    cid: number;
    name: keyof Columns;
    type: SQLiteTypes;
    notnull: 0 | 1;
    dflt_value: any;
    pk: 0 | 1;
}[];

type TableNames<T> = keyof T & string;

type DbOptions = ConstructorParameters<typeof Database>[1] | {
    /**
     * Enables SQLite's WAL mode. Enabled by default.
     *
     * @type {boolean}
     * @default true
     */
    writeAheadLog: boolean;
}

export default class BunLiteDB<Schema extends Record<string, Record<string, unknown>>> {
    private db: Database;
    private tableNames: Set<TableNames<Schema>>;

    /**
     * Creates a new SQLite database connection
     * @param dbName Path to SQLite database file or ":memory:" for in-memory database
     * @param tableNames Optional array of table names that will be used with this connection. If not provided, existing tables will be used.
     * @param opts Database connection options
     * @throws {SQLError} If database cannot be opened or initialized
     */
    constructor(
        dbName: ":memory:" | (string & {}),
        tableNames?: TableNames<Schema>[],
        opts?: DbOptions
    ) {
        const newOpts = typeof opts === "number" ? opts : {
            create: true,
            strict: true,
            writeAheadLog: true,
            ...opts,
        };

        const useWal: boolean = typeof newOpts !== "number" ? newOpts.writeAheadLog ?? true : false;

        try {
            this.db = new Database(dbName, newOpts);
            if (useWal) {
                console.log("foo!");
                this.db.exec("PRAGMA journal_mode = WAL;");
            }
        } catch (error: any) {
            if (error.code === "SQLITE_CANTOPEN") {
                throw new SQLError(`Unable to access database: "${dbName}". ${error}`);
            }
            throw new SQLError(`Database error: ${error}`);
        }

        if (this.db === undefined) {
            throw new SQLError('Failed to construct database.');
        }

        this.tableNames = tableNames 
            ? new Set(tableNames)
            : new Set(this.getExistingTableNames() as TableNames<Schema>[]);
    }

    /**
     * Gets all existing table names from the database
     * @private
     * @returns Array of table names
     */
    private getExistingTableNames(): TableNames<Schema>[] {
        const query = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`;
        const results = this.db.query(query).all() as { name: string }[];
        return results.map(row => row.name);
    }

    /**
     * Sets the SQLite foreign key enforcement mode.
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
    public getSchema<T extends TableNames<Schema>>(tableName: T): OutputSchema<Schema[T]> {
        this.validateTableName(tableName);
        return this.db.query(`PRAGMA table_info(${tableName})`).all() as unknown as OutputSchema<Schema[T]>;
    }

    /**
     * Validates if a table name exists in the allowed set
     * @param tableName Name of the table to validate
     * @throws {Error} If table name is not in the allowed set
     */
    public validateTableName(tableName: string): asserts tableName is TableNames<Schema> {
        this.validateSQLiteIdentifier(tableName, 'table');
        if (!this.tableNames.has(tableName as TableNames<Schema>)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }
    }

    /**
     * Validates SQLite identifiers (table and column names)
     * @param name Name of the identifier to validate
     * @param type Type of the identifier ('table' or 'column')
     * @throws {SQLError} If the identifier is invalid
     */
    private validateSQLiteIdentifier(name: string, type: 'table' | 'column'): void {
        if (!name.match(/^[a-zA-Z_][a-zA-Z0-9_$]*$/)) {
            throw new SQLError(
                `Invalid ${type} name "${name}". ${type} names must start with a letter or underscore and contain only letters, numbers, underscores, or $.`
            );
        }
    }

    /**
     * Creates a new table if it doesn't exist
     * @param tableName Name of the table to create
     * @param columns Array of column definitions with types and constraints
     * @throws {SQLError} If table creation fails
     */
    createTable<T extends TableNames<Schema>>(
        tableName: T,
        columns: TableSchema<Schema[T]>
    ): void {
        this.validateTableName(tableName);
        const foreignKeys: string[] = [];
        const columnsDefinition: string = columns
            .map((col) => {
                this.validateSQLiteIdentifier(String(col.name), 'column');
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
    insertRecord<T extends TableNames<Schema>>(
        tableName: T,
        values: Partial<Schema[T]>
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
    upsertRecord<T extends TableNames<Schema>>(
        tableName: T,
        values: Partial<Schema[T]>,
        conflictColumn: keyof Schema[T] & string,
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
    fetchAllRecords<T extends TableNames<Schema>>(tableName: T, limit?: number): Schema[T][] {
        this.validateTableName(tableName);
        let fetchQuery: string = `SELECT * FROM ${tableName}`;
        if (limit) {
            fetchQuery += ` LIMIT ?`;
            const results = this.db.query(fetchQuery).all(limit);
            return results as Schema[T][];
        } else {
            const results = this.db.query(fetchQuery).all();
            return results as Schema[T][];
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
    fetchRecordsWithCondition<T extends TableNames<Schema>>(
        tableName: T,
        condition: string,
        values: SQLQueryBindings[]
    ): Schema[T][] {
        this.validateTableName(tableName);
        const fetchQuery: string = `SELECT * FROM ${tableName} WHERE ${condition}`;
        const results: unknown[] = this.db.query(fetchQuery).all(...values);
        return results as Schema[T][];
    }

    /**
     * Fetches records with pagination support
     * @param tableName Name of the table to query
     * @param page Page number (starts from 1)
     * @param pageSize Number of records per page
     * @returns Array of records for the requested page
     * @throws {Error} If table name is invalid or pagination parameters are invalid
     */
    fetchRecordsWithPagination<T extends TableNames<Schema>>(
        tableName: T,
        page: number,
        pageSize: number
    ): Schema[T][] {
        this.validateTableName(tableName);
        if (page < 1) throw new Error('Page number must be greater than 0');
        if (pageSize < 1) throw new Error('Page size must be greater than 0');

        const offset = (page - 1) * pageSize;
        const query = `SELECT * FROM ${tableName} LIMIT ? OFFSET ?`;
        return this.db.query(query).all(pageSize, offset) as Schema[T][];
    }

    /**
     * Creates an iterator that yields records one at a time
     * @param tableName Name of the table to iterate
     * @param batchSize Number of records to fetch per batch (default: 1000)
     * @yields Records from the table one at a time
     * @throws {Error} If table name is invalid
     */
    async *recordsIterator<T extends TableNames<Schema>>(
        tableName: T,
        batchSize: number = 1000
    ): AsyncGenerator<Schema[T], void, unknown> {
        this.validateTableName(tableName);
        let offset = 0;
        
        while (true) {
            const query = `SELECT * FROM ${tableName} LIMIT ? OFFSET ?`;
            const batch = this.db.query(query).all(batchSize, offset) as Schema[T][];
            
            if (batch.length === 0) break;
            
            for (const record of batch) {
                yield record;
            }
            
            if (batch.length < batchSize) break;
            offset += batchSize;
        }
    }

    /**
     * Deletes a table from the database
     * @param tableName Name of the table to delete
     * @throws {SQLError} If table deletion fails
     */
    deleteTable(tableName: TableNames<Schema>): void {
        this.validateTableName(tableName);
        try {
            const schemaQuery: string = `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`;
            const result = this.db.query(schemaQuery).all();

            if (result.length > 0) {
                const dropQuery: string = `DROP TABLE ${tableName}`;
                this.db.run(dropQuery);
                this.tableNames.delete(tableName);
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