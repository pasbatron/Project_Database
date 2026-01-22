require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const moment = require('moment');

const app = express();
const PORT = process.env.PORT || 5000;

// ========== MIDDLEWARE ==========
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== DATABASE CONFIGURATION ==========
const servers = {
  server1: {
    name: 'Server 1 (Primary)',
    host: process.env.DB_SERVER1_HOST || 'localhost',
    port: parseInt(process.env.DB_SERVER1_PORT) || 3306,
    user: process.env.DB_SERVER1_USER || 'root',
    password: process.env.DB_SERVER1_PASSWORD || 'password1',
    database: process.env.DB_SERVER1_NAME || 'database1',
    pool: null
  },
  server2: {
    name: 'Server 2 (Backup 1)',
    host: process.env.DB_SERVER2_HOST || 'localhost',
    port: parseInt(process.env.DB_SERVER2_PORT) || 3307,
    user: process.env.DB_SERVER2_USER || 'root',
    password: process.env.DB_SERVER2_PASSWORD || 'password2',
    database: process.env.DB_SERVER2_NAME || 'database2',
    pool: null
  },
  server3: {
    name: 'Server 3 (Backup 2)',
    host: process.env.DB_SERVER3_HOST || 'localhost',
    port: parseInt(process.env.DB_SERVER3_PORT) || 3308,
    user: process.env.DB_SERVER3_USER || 'root',
    password: process.env.DB_SERVER3_PASSWORD || 'password3',
    database: process.env.DB_SERVER3_NAME || 'database3',
    pool: null
  },
  server4: {
    name: 'Server 4 (Backup 3)',
    host: process.env.DB_SERVER4_HOST || 'localhost',
    port: parseInt(process.env.DB_SERVER4_PORT) || 3309,
    user: process.env.DB_SERVER4_USER || 'root',
    password: process.env.DB_SERVER4_PASSWORD || 'password4',
    database: process.env.DB_SERVER4_NAME || 'database4',
    pool: null
  }
};

// ========== DATABASE POOL INITIALIZATION ==========
function initializeDatabasePools() {
  Object.keys(servers).forEach(serverId => {
    const server = servers[serverId];
    try {
      server.pool = mysql.createPool({
        host: server.host,
        port: server.port,
        user: server.user,
        password: server.password,
        database: server.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
      });
      console.log(`✅ Pool created for ${server.name}`);
    } catch (error) {
      console.error(`❌ Failed to create pool for ${server.name}:`, error.message);
    }
  });
}

// ========== SYNC JOBS MANAGEMENT ==========
const syncJobs = new Map();
const SYNC_DAYS_THRESHOLD = parseInt(process.env.SYNC_DAYS_THRESHOLD) || 2;
const MAX_SYNC_ROWS = parseInt(process.env.MAX_SYNC_ROWS) || 10000;

// ========== HELPER FUNCTIONS ==========
async function testConnection(serverId) {
  try {
    const server = servers[serverId];
    if (!server || !server.pool) {
      return { success: false, error: 'Server not configured' };
    }
    
    const [rows] = await server.pool.query('SELECT 1 as connected');
    return { 
      success: true, 
      server: serverId,
      name: server.name,
      host: server.host,
      port: server.port,
      database: server.database
    };
  } catch (error) {
    return { 
      success: false, 
      server: serverId, 
      name: servers[serverId]?.name,
      error: error.message 
    };
  }
}

async function getAllConnectionsStatus() {
  const serverIds = Object.keys(servers);
  const statuses = await Promise.all(
    serverIds.map(serverId => testConnection(serverId))
  );
  return statuses;
}

async function getTables(serverId) {
  try {
    const server = servers[serverId];
    if (!server || !server.pool) {
      throw new Error(`Server ${serverId} not configured`);
    }
    
    const [tables] = await server.pool.query(`
      SELECT 
        TABLE_NAME as tableName,
        TABLE_ROWS as rowCount,
        CREATE_TIME as createTime,
        UPDATE_TIME as updateTime,
        DATA_LENGTH as dataSize,
        INDEX_LENGTH as indexSize,
        TABLE_TYPE as tableType
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME
    `);
    
    return tables;
  } catch (error) {
    console.error(`Error getting tables for ${serverId}:`, error);
    throw error;
  }
}

async function getTableStructure(serverId, tableName) {
  try {
    const server = servers[serverId];
    if (!server || !server.pool) {
      throw new Error(`Server ${serverId} not configured`);
    }
    
    const [columns] = await server.pool.query(`
      SELECT 
        COLUMN_NAME as columnName,
        DATA_TYPE as dataType,
        CHARACTER_MAXIMUM_LENGTH as maxLength,
        IS_NULLABLE as isNullable,
        COLUMN_KEY as columnKey,
        COLUMN_DEFAULT as columnDefault,
        EXTRA as extra,
        COLUMN_TYPE as columnType,
        COLUMN_COMMENT as comment
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [tableName]);
    
    return columns;
  } catch (error) {
    console.error(`Error getting structure for ${tableName}:`, error);
    throw error;
  }
}

async function getTableRowCount(serverId, tableName) {
  try {
    const server = servers[serverId];
    if (!server || !server.pool) {
      throw new Error(`Server ${serverId} not configured`);
    }
    
    const [result] = await server.pool.query(`SELECT COUNT(*) as count FROM ??`, [tableName]);
    return result[0].count;
  } catch (error) {
    console.error(`Error getting row count for ${tableName}:`, error);
    throw error;
  }
}

async function getPrimaryKeys(serverId, tableName) {
  try {
    const server = servers[serverId];
    if (!server || !server.pool) {
      throw new Error(`Server ${serverId} not configured`);
    }
    
    const [pks] = await server.pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ? 
        AND CONSTRAINT_NAME = 'PRIMARY'
    `, [tableName]);
    
    return pks.map(pk => pk.COLUMN_NAME);
  } catch (error) {
    console.error(`Error getting primary keys for ${tableName}:`, error);
    return [];
  }
}

async function getSyncData(sourceServerId, targetServerId, tableName, daysThreshold = SYNC_DAYS_THRESHOLD) {
  try {
    const sourceServer = servers[sourceServerId];
    const targetServer = servers[targetServerId];
    
    if (!sourceServer || !sourceServer.pool || !targetServer || !targetServer.pool) {
      throw new Error('Source or target server not configured');
    }
    
    // Get primary keys
    const pkColumns = await getPrimaryKeys(sourceServerId, tableName);
    
    if (pkColumns.length === 0) {
      throw new Error(`Table ${tableName} has no primary key`);
    }
    
    // Check if table has updated_at column
    const [hasUpdatedAt] = await sourceServer.pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ? 
        AND COLUMN_NAME = 'updated_at'
    `, [tableName]);
    
    let whereClause = '';
    let params = [tableName];
    
    if (hasUpdatedAt.length > 0) {
      // Use incremental sync based on updated_at
      whereClause = 'WHERE s.updated_at > DATE_SUB(NOW(), INTERVAL ? DAY)';
      params.push(daysThreshold);
    } else {
      // Full table comparison (limit to max rows for safety)
      console.warn(`Table ${tableName} has no updated_at column, performing full comparison (limited to ${MAX_SYNC_ROWS} rows)`);
    }
    
    // Get records that are different or missing in target
    const query = `
      SELECT s.* 
      FROM ?? s
      LEFT JOIN ${targetServer.database}.?? t ON 
        ${pkColumns.map(col => `s.${col} = t.${col}`).join(' AND ')}
      ${whereClause}
      WHERE t.${pkColumns[0]} IS NULL
      OR ${hasUpdatedAt.length > 0 ? 's.updated_at > t.updated_at' : '1=1'}
      LIMIT ?
    `;
    
    params.push(tableName, MAX_SYNC_ROWS);
    
    const [rows] = await sourceServer.pool.query(query, params);
    return rows;
  } catch (error) {
    console.error(`Error getting sync data for ${tableName}:`, error);
    throw error;
  }
}

async function syncTable(sourceServerId, targetServerId, tableName, data) {
  try {
    const targetServer = servers[targetServerId];
    if (!targetServer || !targetServer.pool) {
      throw new Error(`Target server ${targetServerId} not configured`);
    }
    
    if (data.length === 0) {
      return { synced: 0, skipped: 0, inserted: 0, updated: 0 };
    }
    
    const columns = Object.keys(data[0]);
    const placeholders = data.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
    const values = data.flatMap(row => columns.map(col => row[col]));
    
    const query = `
      INSERT INTO ?? (${columns.join(',')})
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
      ${columns.map(col => `${col} = VALUES(${col})`).join(',')}
    `;
    
    const [result] = await targetServer.pool.query(query, [tableName, ...values]);
    
    const inserted = result.affectedRows - (result.changedRows || 0);
    const updated = result.changedRows || 0;
    
    return {
      synced: result.affectedRows,
      skipped: data.length - result.affectedRows,
      inserted,
      updated
    };
  } catch (error) {
    console.error(`Error syncing table ${tableName}:`, error);
    throw error;
  }
}

async function executeSyncJob(job) {
  try {
    job.status = 'running';
    job.startTime = new Date();
    
    // Validate servers
    const sourceStatus = await testConnection(job.sourceServer);
    const targetStatus = await testConnection(job.targetServer);
    
    if (!sourceStatus.success || !targetStatus.success) {
      throw new Error(`Source or target server is not available`);
    }
    
    for (let i = 0; i < job.tables.length; i++) {
      const table = job.tables[i];
      
      try {
        job.details[table] = {
          status: 'syncing',
          rowsFetched: 0,
          rowsSynced: 0,
          inserted: 0,
          updated: 0,
          errors: []
        };
        
        // Get data to sync
        const data = await getSyncData(
          job.sourceServer,
          job.targetServer,
          table,
          job.options.daysThreshold || SYNC_DAYS_THRESHOLD
        );
        
        job.details[table].rowsFetched = data.length;
        
        if (data.length > 0) {
          // Perform sync
          const result = await syncTable(
            job.sourceServer,
            job.targetServer,
            table,
            data
          );
          
          job.details[table].rowsSynced = result.synced;
          job.details[table].inserted = result.inserted;
          job.details[table].updated = result.updated;
          job.details[table].status = 'completed';
        } else {
          job.details[table].status = 'no_changes';
        }
        
        job.completedTables++;
        job.progress = Math.round((job.completedTables / job.totalTables) * 100);
        
        // Update job in map
        syncJobs.set(job.id, job);
        
        // Small delay between tables to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (tableError) {
        job.details[table] = {
          status: 'failed',
          error: tableError.message,
          rowsFetched: 0,
          rowsSynced: 0
        };
        console.error(`Table ${table} sync failed:`, tableError);
      }
    }
    
    job.status = 'completed';
    job.endTime = new Date();
    job.duration = moment(job.endTime).diff(moment(job.startTime), 'seconds');
    
    console.log(`✅ Sync job ${job.id} completed successfully`);
    
  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
    job.endTime = new Date();
    console.error(`❌ Sync job ${job.id} failed:`, error);
    throw error;
  }
}

// ========== API ROUTES ==========

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Get all servers status
app.get('/api/servers', async (req, res) => {
  try {
    const statuses = await getAllConnectionsStatus();
    
    const serverInfo = {};
    Object.keys(servers).forEach(serverId => {
      serverInfo[serverId] = {
        name: servers[serverId].name,
        host: servers[serverId].host,
        port: servers[serverId].port,
        database: servers[serverId].database,
        status: statuses.find(s => s.server === serverId)?.success ? 'online' : 'offline'
      };
    });
    
    res.json({
      success: true,
      servers: serverInfo,
      statuses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get tables for a server
app.get('/api/servers/:serverId/tables', async (req, res) => {
  try {
    const { serverId } = req.params;
    
    if (!servers[serverId]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid server ID'
      });
    }
    
    const tables = await getTables(serverId);
    
    res.json({
      success: true,
      tables,
      server: serverId,
      serverName: servers[serverId].name
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get table structure
app.get('/api/servers/:serverId/tables/:tableName', async (req, res) => {
  try {
    const { serverId, tableName } = req.params;
    
    if (!servers[serverId]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid server ID'
      });
    }
    
    const [structure, rowCount] = await Promise.all([
      getTableStructure(serverId, tableName),
      getTableRowCount(serverId, tableName)
    ]);
    
    res.json({
      success: true,
      tableName,
      structure,
      rowCount,
      server: serverId,
      serverName: servers[serverId].name
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Compare tables between servers
app.get('/api/compare/:sourceServer/:targetServer/:tableName', async (req, res) => {
  try {
    const { sourceServer, targetServer, tableName } = req.params;
    
    if (!servers[sourceServer] || !servers[targetServer]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid server ID'
      });
    }
    
    const [sourceCount, targetCount, sourceStructure, targetStructure] = await Promise.all([
      getTableRowCount(sourceServer, tableName),
      getTableRowCount(targetServer, tableName),
      getTableStructure(sourceServer, tableName),
      getTableStructure(targetServer, tableName)
    ]);
    
    const differences = [];
    
    // Compare row counts
    if (sourceCount !== targetCount) {
      differences.push({
        type: 'row_count',
        source: sourceCount,
        target: targetCount,
        difference: sourceCount - targetCount
      });
    }
    
    // Compare structure
    const sourceColumns = new Map(sourceStructure.map(col => [col.columnName, col]));
    const targetColumns = new Map(targetStructure.map(col => [col.columnName, col]));
    
    const allColumns = new Set([
      ...sourceStructure.map(col => col.columnName),
      ...targetStructure.map(col => col.columnName)
    ]);
    
    for (const columnName of allColumns) {
      const sourceCol = sourceColumns.get(columnName);
      const targetCol = targetColumns.get(columnName);
      
      if (!sourceCol && targetCol) {
        differences.push({
          type: 'column_missing_in_source',
          column: columnName,
          targetType: targetCol.dataType
        });
      } else if (sourceCol && !targetCol) {
        differences.push({
          type: 'column_missing_in_target',
          column: columnName,
          sourceType: sourceCol.dataType
        });
      } else if (sourceCol && targetCol) {
        if (sourceCol.dataType !== targetCol.dataType ||
            sourceCol.columnType !== targetCol.columnType) {
          differences.push({
            type: 'column_type_mismatch',
            column: columnName,
            sourceType: sourceCol.dataType,
            targetType: targetCol.dataType,
            sourceFullType: sourceCol.columnType,
            targetFullType: targetCol.columnType
          });
        }
      }
    }
    
    res.json({
      success: true,
      comparison: {
        tableName,
        sourceCount,
        targetCount,
        differences,
        sourceStructure,
        targetStructure,
        sourceServer: {
          id: sourceServer,
          name: servers[sourceServer].name
        },
        targetServer: {
          id: targetServer,
          name: servers[targetServer].name
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start synchronization
app.post('/api/sync', async (req, res) => {
  try {
    const { sourceServer, targetServer, tables, options = {} } = req.body;
    
    // Validation
    if (!sourceServer || !targetServer) {
      return res.status(400).json({
        success: false,
        error: 'Source and target servers are required'
      });
    }
    
    if (!servers[sourceServer] || !servers[targetServer]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid server ID'
      });
    }
    
    if (sourceServer === targetServer) {
      return res.status(400).json({
        success: false,
        error: 'Source and target servers cannot be the same'
      });
    }
    
    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one table must be selected'
      });
    }
    
    // Validate options
    const daysThreshold = Math.min(Math.max(parseInt(options.daysThreshold) || SYNC_DAYS_THRESHOLD, 1), 30);
    
    // Create job
    const jobId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job = {
      id: jobId,
      sourceServer,
      targetServer,
      tables,
      options: {
        daysThreshold,
        syncMethod: options.syncMethod || 'incremental',
        excludeColumns: options.excludeColumns || []
      },
      status: 'pending',
      startTime: null,
      endTime: null,
      duration: null,
      progress: 0,
      totalTables: tables.length,
      completedTables: 0,
      details: {},
      error: null,
      created: new Date()
    };
    
    syncJobs.set(jobId, job);
    
    // Execute in background
    executeSyncJob(job).catch(error => {
      console.error(`Background sync error for job ${jobId}:`, error);
    });
    
    res.json({
      success: true,
      jobId,
      message: 'Sync job started successfully',
      job: {
        id: jobId,
        sourceServer,
        targetServer,
        tablesCount: tables.length,
        status: 'started'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get sync job status
app.get('/api/sync/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = syncJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
    
    // Return minimal job info for security
    const response = {
      id: job.id,
      sourceServer: job.sourceServer,
      targetServer: job.targetServer,
      status: job.status,
      progress: job.progress,
      totalTables: job.totalTables,
      completedTables: job.completedTables,
      startTime: job.startTime,
      endTime: job.endTime,
      duration: job.duration,
      error: job.error,
      details: job.details
    };
    
    res.json({
      success: true,
      job: response
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get active sync jobs
app.get('/api/sync/active', async (req, res) => {
  try {
    const activeJobs = Array.from(syncJobs.values())
      .filter(job => job.status === 'running' || job.status === 'pending')
      .map(job => ({
        id: job.id,
        sourceServer: job.sourceServer,
        targetServer: job.targetServer,
        status: job.status,
        progress: job.progress,
        totalTables: job.totalTables,
        completedTables: job.completedTables,
        startTime: job.startTime
      }));
    
    res.json({
      success: true,
      jobs: activeJobs,
      count: activeJobs.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get sync history
app.get('/api/sync/history', async (req, res) => {
  try {
    const { limit = 50, status } = req.query;
    
    let history = Array.from(syncJobs.values())
      .filter(job => job.status === 'completed' || job.status === 'failed')
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    
    if (status) {
      history = history.filter(job => job.status === status);
    }
    
    history = history.slice(0, parseInt(limit));
    
    const formattedHistory = history.map(job => ({
      id: job.id,
      sourceServer: job.sourceServer,
      targetServer: job.targetServer,
      status: job.status,
      tablesCount: job.totalTables,
      startTime: job.startTime,
      endTime: job.endTime,
      duration: job.duration,
      error: job.error
    }));
    
    res.json({
      success: true,
      history: formattedHistory,
      count: formattedHistory.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test server connection
app.post('/api/servers/test', async (req, res) => {
  try {
    const { serverId } = req.body;
    
    if (!servers[serverId]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid server ID'
      });
    }
    
    const status = await testConnection(serverId);
    
    res.json({
      success: status.success,
      server: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get database statistics
app.get('/api/statistics', async (req, res) => {
  try {
    const serverIds = Object.keys(servers);
    const stats = {};
    
    for (const serverId of serverIds) {
      try {
        const tables = await getTables(serverId);
        const totalRows = tables.reduce((sum, table) => sum + (parseInt(table.rowCount) || 0), 0);
        const totalSize = tables.reduce((sum, table) => sum + (parseInt(table.dataSize) || 0) + (parseInt(table.indexSize) || 0), 0);
        
        stats[serverId] = {
          name: servers[serverId].name,
          tablesCount: tables.length,
          totalRows,
          totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
          status: (await testConnection(serverId)).success ? 'online' : 'offline'
        };
      } catch (error) {
        stats[serverId] = {
          name: servers[serverId].name,
          error: error.message,
          status: 'error'
        };
      }
    }
    
    res.json({
      success: true,
      statistics: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get table data preview
app.get('/api/servers/:serverId/tables/:tableName/data', async (req, res) => {
  try {
    const { serverId, tableName } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    
    if (!servers[serverId]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid server ID'
      });
    }
    
    const server = servers[serverId];
    const [rows] = await server.pool.query(
      `SELECT * FROM ?? LIMIT ? OFFSET ?`,
      [tableName, parseInt(limit), parseInt(offset)]
    );
    
    // Get column names
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    
    res.json({
      success: true,
      tableName,
      columns,
      data: rows,
      limit: parseInt(limit),
      offset: parseInt(offset),
      total: await getTableRowCount(serverId, tableName)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cancel sync job
app.post('/api/sync/cancel/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = syncJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
    
    if (job.status !== 'running' && job.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel job with status: ${job.status}`
      });
    }
    
    job.status = 'cancelled';
    job.endTime = new Date();
    job.error = 'Job cancelled by user';
    
    res.json({
      success: true,
      message: 'Job cancelled successfully',
      jobId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ========== INITIALIZE AND START SERVER ==========
async function startServer() {
  try {
    // Initialize database pools
    initializeDatabasePools();
    
    // Test all connections
    console.log('Testing database connections...');
    const statuses = await getAllConnectionsStatus();
    
    statuses.forEach(status => {
      if (status.success) {
        console.log(`✅ ${status.name || status.server}: Connected`);
      } else {
        console.log(`❌ ${status.name || status.server}: ${status.error}`);
      }
    });
    
    // Start server
    app.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(`🚀 Database Sync Manager is running`);
      console.log(`📍 Port: ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📅 Started: ${new Date().toISOString()}`);
      console.log(`=========================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  
  // Close all database connections
  Object.keys(servers).forEach(serverId => {
    if (servers[serverId].pool) {
      servers[serverId].pool.end();
      console.log(`Closed connections for ${servers[serverId].name}`);
    }
  });
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  
  Object.keys(servers).forEach(serverId => {
    if (servers[serverId].pool) {
      servers[serverId].pool.end();
      console.log(`Closed connections for ${servers[serverId].name}`);
    }
  });
  
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;