import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  CircularProgress,
  Tabs,
  Tab,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemButton,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Tooltip,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  TablePagination
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Storage,
  Sync,
  TableChart,
  History,
  Settings,
  ChevronLeft,
  Person,
  PlayArrow,
  Refresh,
  CompareArrows,
  Warning,
  Error,
  CheckCircle,
  Pending,
  Cancel,
  ExpandMore,
  Info,
  CloudUpload,
  CloudDownload,
  ViewList,
  Speed,
  Visibility,
  Delete,
  Close,
  ArrowForward,
  Timeline,
  BarChart,
  Notifications,
  Security,
  Backup,
  Restore,
  FilterList,
  Sort,
  Search,
  Download,
  Upload,
  MoreVert,
  SettingsApplications,
  Dns,
  Computer,
  Storage as StorageIcon,
  Lan,
  Cloud,
  Wifi,
  WifiOff,
  SignalCellularAlt,
  SignalCellularOff,
  DateRange,
  AccessTime,
  Schedule,
  Timer,
  TimerOff,
  Pause,
  Stop,
  FastForward,
  FastRewind,
  SkipNext,
  SkipPrevious,
  PlayCircle,
  PauseCircle,
  StopCircle,
  FiberManualRecord,
  RadioButtonUnchecked,
  CheckBox,
  CheckBoxOutlineBlank,
  IndeterminateCheckBox,
  ToggleOn,
  ToggleOff,
  PowerSettingsNew,
  PowerOff,
  BatteryFull,
  BatteryAlert,
  BatteryChargingFull,
  BatteryStd
} from '@mui/icons-material';

// Konfigurasi API
const API_BASE_URL = 'http://localhost:5000/api';

// Alert component untuk Snackbar
const AlertComponent = React.forwardRef(function AlertComponent(props, ref) {
  return (
    <Box
      ref={ref}
      sx={{
        backgroundColor: props.severity === 'error' ? '#f44336' :
                        props.severity === 'warning' ? '#ff9800' :
                        props.severity === 'info' ? '#2196f3' : '#4caf50',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '4px',
        boxShadow: '0px 3px 5px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minWidth: '300px'
      }}
      {...props}
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {props.severity === 'error' && <Error sx={{ mr: 1 }} />}
        {props.severity === 'warning' && <Warning sx={{ mr: 1 }} />}
        {props.severity === 'info' && <Info sx={{ mr: 1 }} />}
        {props.severity === 'success' && <CheckCircle sx={{ mr: 1 }} />}
        <Typography variant="body2">{props.children}</Typography>
      </Box>
      {props.onClose && (
        <IconButton size="small" onClick={props.onClose} sx={{ color: 'white', ml: 2 }}>
          <Close />
        </IconButton>
      )}
    </Box>
  );
});

// App Component
function App() {
  // State untuk navigasi
  const [activeTab, setActiveTab] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(true);
  
  // State untuk servers
  const [servers, setServers] = useState({});
  const [serverStatus, setServerStatus] = useState([]);
  
  // State untuk sync
  const [sourceServer, setSourceServer] = useState('');
  const [targetServer, setTargetServer] = useState('');
  const [selectedTables, setSelectedTables] = useState([]);
  const [tables, setTables] = useState([]);
  const [syncOptions, setSyncOptions] = useState({
    daysThreshold: 2,
    syncMethod: 'incremental',
    excludeColumns: []
  });
  
  // State untuk jobs
  const [activeJobs, setActiveJobs] = useState([]);
  const [syncHistory, setSyncHistory] = useState([]);
  const [currentJob, setCurrentJob] = useState(null);
  
  // State untuk UI
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  
  // State untuk table explorer
  const [expandedTable, setExpandedTable] = useState(null);
  const [tableData, setTableData] = useState({});
  const [tablePage, setTablePage] = useState(0);
  const [tableRowsPerPage, setTableRowsPerPage] = useState(10);
  
  // State untuk dialog
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [serverDialogOpen, setServerDialogOpen] = useState(false);
  const [selectedServerInfo, setSelectedServerInfo] = useState(null);

  // Menu items untuk drawer
  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, id: 0 },
    { text: 'Server Status', icon: <Storage />, id: 1 },
    { text: 'Sync Manager', icon: <Sync />, id: 2 },
    { text: 'Table Explorer', icon: <TableChart />, id: 3 },
    { text: 'Sync History', icon: <History />, id: 4 },
    { text: 'Settings', icon: <Settings />, id: 5 },
  ];

  // Fetch initial data
  useEffect(() => {
    fetchServers();
    fetchActiveJobs();
    fetchSyncHistory();
    
    // Polling untuk update real-time
    const interval = setInterval(() => {
      fetchActiveJobs();
      if (activeTab === 0 || activeTab === 1) {
        fetchServers();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [activeTab]);

  // API Functions
  const fetchServers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/servers`);
      if (response.data.success) {
        setServers(response.data.servers);
        setServerStatus(response.data.statuses || []);
      }
    } catch (error) {
      showSnackbar('Error fetching servers', 'error');
    }
  };

  const fetchTables = async (serverId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/servers/${serverId}/tables`);
      if (response.data.success) {
        setTables(response.data.tables || []);
      }
    } catch (error) {
      showSnackbar('Error fetching tables', 'error');
    }
  };

  const fetchActiveJobs = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/sync/active`);
      if (response.data.success) {
        setActiveJobs(response.data.jobs || []);
      }
    } catch (error) {
      // Silent error untuk polling
    }
  };

  const fetchSyncHistory = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/sync/history?limit=20`);
      if (response.data.success) {
        setSyncHistory(response.data.history || []);
      }
    } catch (error) {
      showSnackbar('Error fetching history', 'error');
    }
  };

  const startSync = async () => {
    if (!sourceServer || !targetServer || selectedTables.length === 0) {
      showSnackbar('Please select source, target, and at least one table', 'warning');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/sync`, {
        sourceServer,
        targetServer,
        tables: selectedTables,
        options: syncOptions
      });

      if (response.data.success) {
        showSnackbar('Sync job started successfully!', 'success');
        setCurrentJob(response.data.jobId);
        fetchActiveJobs();
      }
    } catch (error) {
      showSnackbar(error.response?.data?.error || 'Failed to start sync', 'error');
    } finally {
      setLoading(false);
    }
  };

  const compareTables = async (tableName) => {
    if (!sourceServer || !targetServer) {
      showSnackbar('Please select source and target servers first', 'warning');
      return;
    }

    try {
      const response = await axios.get(
        `${API_BASE_URL}/compare/${sourceServer}/${targetServer}/${tableName}`
      );

      if (response.data.success) {
        setCompareData(response.data.comparison);
        setCompareDialogOpen(true);
      }
    } catch (error) {
      showSnackbar('Failed to compare tables', 'error');
    }
  };

  const fetchTableData = async (serverId, tableName) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/servers/${serverId}/tables/${tableName}/data?limit=${tableRowsPerPage}&offset=${tablePage * tableRowsPerPage}`
      );

      if (response.data.success) {
        setTableData(prev => ({
          ...prev,
          [tableName]: response.data
        }));
      }
    } catch (error) {
      showSnackbar('Error fetching table data', 'error');
    }
  };

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleSourceServerChange = (event) => {
    const serverId = event.target.value;
    setSourceServer(serverId);
    setSelectedTables([]);
    if (serverId) {
      fetchTables(serverId);
    } else {
      setTables([]);
    }
  };

  const handleTableSelection = (tableName) => {
    setSelectedTables(prev =>
      prev.includes(tableName)
        ? prev.filter(t => t !== tableName)
        : [...prev, tableName]
    );
  };

  const handleSelectAllTables = () => {
    if (selectedTables.length === tables.length) {
      setSelectedTables([]);
    } else {
      setSelectedTables(tables.map(t => t.tableName));
    }
  };

  const handleTablePageChange = (event, newPage) => {
    setTablePage(newPage);
    if (expandedTable) {
      fetchTableData(sourceServer, expandedTable);
    }
  };

  const handleTableRowsPerPageChange = (event) => {
    setTableRowsPerPage(parseInt(event.target.value, 10));
    setTablePage(0);
    if (expandedTable) {
      fetchTableData(sourceServer, expandedTable);
    }
  };

  const handleTableExpand = async (tableName) => {
    if (expandedTable === tableName) {
      setExpandedTable(null);
    } else {
      setExpandedTable(tableName);
      if (!tableData[tableName]) {
        await fetchTableData(sourceServer, tableName);
      }
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online': return <CheckCircle color="success" />;
      case 'offline': return <Error color="error" />;
      default: return <Pending color="warning" />;
    }
  };

  const getSyncStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'running': return 'info';
      case 'pending': return 'warning';
      case 'failed': return 'error';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      return dateString;
    }
  };

  // Komponen Dashboard
  const DashboardTab = () => (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Database Sync Dashboard
      </Typography>
      
      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {Object.entries(servers).map(([id, server]) => {
          const status = serverStatus.find(s => s.server === id);
          return (
            <Grid item xs={12} sm={6} md={3} key={id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <StorageIcon sx={{ mr: 2, color: status?.success ? 'success.main' : 'error.main' }} />
                    <Typography variant="h6" component="div">
                      {server.name}
                    </Typography>
                  </Box>
                  <Typography color="text.secondary" variant="body2">
                    {server.host}:{server.port}
                  </Typography>
                  <Typography variant="body2">
                    Database: {server.database}
                  </Typography>
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                    <Chip
                      icon={getStatusIcon(status?.success ? 'online' : 'offline')}
                      label={status?.success ? 'Online' : 'Offline'}
                      color={status?.success ? 'success' : 'error'}
                      size="small"
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Active Jobs */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Active Sync Jobs
        </Typography>
        {activeJobs.length > 0 ? (
          activeJobs.map(job => (
            <Card key={job.id} sx={{ mb: 2 }}>
              <CardContent>
                <Grid container alignItems="center" spacing={2}>
                  <Grid item xs={12} md={8}>
                    <Typography variant="subtitle1">
                      {servers[job.sourceServer]?.name} → {servers[job.targetServer]?.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                      <Box sx={{ width: '100%', mr: 1 }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={job.progress || 0} 
                        />
                      </Box>
                      <Typography variant="body2">
                        {job.progress || 0}%
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Started: {formatDate(job.startTime)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4} sx={{ textAlign: { md: 'right' } }}>
                    <Chip 
                      label={job.status} 
                      color={getSyncStatusColor(job.status)}
                      size="small" 
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          ))
        ) : (
          <Box sx={{ p: 2, textAlign: 'center', backgroundColor: '#f5f5f5', borderRadius: 1 }}>
            <Typography color="text.secondary">No active sync jobs</Typography>
          </Box>
        )}
      </Paper>

      {/* Quick Actions */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Quick Actions
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<Sync />}
              onClick={() => setActiveTab(2)}
            >
              Start New Sync
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Refresh />}
              onClick={fetchServers}
            >
              Refresh Status
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<TableChart />}
              onClick={() => setActiveTab(3)}
            >
              Explore Tables
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<History />}
              onClick={() => {
                setActiveTab(4);
                fetchSyncHistory();
              }}
            >
              View History
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );

  // Komponen Server Status
  const ServerStatusTab = () => (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Server Status & Configuration
      </Typography>
      
      <Grid container spacing={3}>
        {Object.entries(servers).map(([id, server]) => {
          const status = serverStatus.find(s => s.server === id);
          return (
            <Grid item xs={12} md={6} key={id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      {server.name}
                    </Typography>
                    <Chip
                      icon={getStatusIcon(status?.success ? 'online' : 'offline')}
                      label={status?.success ? 'Online' : 'Offline'}
                      color={status?.success ? 'success' : 'error'}
                    />
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Host
                      </Typography>
                      <Typography variant="body1">
                        {server.host}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Port
                      </Typography>
                      <Typography variant="body1">
                        {server.port}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Database
                      </Typography>
                      <Typography variant="body1">
                        {server.database}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        User
                      </Typography>
                      <Typography variant="body1">
                        {server.user || 'root'}
                      </Typography>
                    </Grid>
                  </Grid>
                  
                  {status?.error && (
                    <Box sx={{ mt: 2, p: 1, backgroundColor: '#ffebee', borderRadius: 1 }}>
                      <Typography variant="body2" color="error">
                        Error: {status.error}
                      </Typography>
                    </Box>
                  )}
                  
                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      startIcon={<Refresh />}
                      onClick={() => {
                        axios.post(`${API_BASE_URL}/servers/test`, { serverId: id })
                          .then(response => {
                            showSnackbar(
                              response.data.success 
                                ? `Server ${server.name} is online` 
                                : `Server ${server.name} is offline`,
                              response.data.success ? 'success' : 'error'
                            );
                            fetchServers();
                          });
                      }}
                    >
                      Test Connection
                    </Button>
                    <Button
                      size="small"
                      startIcon={<TableChart />}
                      onClick={() => {
                        setSourceServer(id);
                        fetchTables(id);
                        setActiveTab(3);
                      }}
                    >
                      View Tables
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      
      {/* Server Statistics */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Server Statistics
        </Typography>
        <Button
          startIcon={<Refresh />}
          onClick={async () => {
            try {
              const response = await axios.get(`${API_BASE_URL}/statistics`);
              if (response.data.success) {
                showSnackbar('Statistics updated', 'success');
              }
            } catch (error) {
              showSnackbar('Error fetching statistics', 'error');
            }
          }}
        >
          Refresh Statistics
        </Button>
      </Paper>
    </Container>
  );

  // Komponen Sync Manager
  const SyncManagerTab = () => (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Database Synchronization Manager
      </Typography>

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Active Sync Jobs
          </Typography>
          {activeJobs.map(job => (
            <Card key={job.id} sx={{ mb: 1 }}>
              <CardContent>
                <Grid container alignItems="center" spacing={2}>
                  <Grid item xs={12} md={8}>
                    <Typography variant="body2">
                      {servers[job.sourceServer]?.name} → {servers[job.targetServer]?.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                      <Box sx={{ width: '100%', mr: 1 }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={job.progress} 
                        />
                      </Box>
                      <Typography variant="body2">
                        {job.progress}%
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4} sx={{ textAlign: { md: 'right' } }}>
                    <Chip 
                      label={job.status} 
                      color="primary" 
                      size="small" 
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          ))}
        </Paper>
      )}

      <Grid container spacing={3}>
        {/* Server Selection */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Server Configuration
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={5}>
                <FormControl fullWidth>
                  <InputLabel>Source Server</InputLabel>
                  <Select
                    value={sourceServer}
                    label="Source Server"
                    onChange={handleSourceServerChange}
                  >
                    {Object.entries(servers).map(([id, server]) => (
                      <MenuItem key={id} value={id}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <CloudUpload sx={{ mr: 1, fontSize: 20 }} />
                          {server.name}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2} sx={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowForward sx={{ fontSize: 40, color: 'primary.main' }} />
              </Grid>
              <Grid item xs={12} md={5}>
                <FormControl fullWidth>
                  <InputLabel>Target Server</InputLabel>
                  <Select
                    value={targetServer}
                    label="Target Server"
                    onChange={(e) => setTargetServer(e.target.value)}
                  >
                    {Object.entries(servers)
                      .filter(([id]) => id !== sourceServer)
                      .map(([id, server]) => (
                        <MenuItem key={id} value={id}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <CloudDownload sx={{ mr: 1, fontSize: 20 }} />
                            {server.name}
                          </Box>
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Sync Options */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Sync Options
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Days Threshold</InputLabel>
                    <Select
                      value={syncOptions.daysThreshold}
                      label="Days Threshold"
                      onChange={(e) => setSyncOptions(prev => ({
                        ...prev,
                        daysThreshold: e.target.value
                      }))}
                    >
                      <MenuItem value={1}>1 day</MenuItem>
                      <MenuItem value={2}>2 days</MenuItem>
                      <MenuItem value={3}>3 days</MenuItem>
                      <MenuItem value={7}>7 days</MenuItem>
                      <MenuItem value={14}>14 days</MenuItem>
                      <MenuItem value={30}>30 days</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Sync Method</InputLabel>
                    <Select
                      value={syncOptions.syncMethod}
                      label="Sync Method"
                      onChange={(e) => setSyncOptions(prev => ({
                        ...prev,
                        syncMethod: e.target.value
                      }))}
                    >
                      <MenuItem value="incremental">Incremental (Last X days)</MenuItem>
                      <MenuItem value="full">Full Synchronization</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>

        {/* Table Selection */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Tables ({selectedTables.length} selected of {tables.length})
              </Typography>
              <Box>
                <Button
                  onClick={handleSelectAllTables}
                  sx={{ mr: 1 }}
                  startIcon={selectedTables.length === tables.length ? <CheckBox /> : <CheckBoxOutlineBlank />}
                >
                  {selectedTables.length === tables.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  startIcon={<Refresh />}
                  onClick={() => sourceServer && fetchTables(sourceServer)}
                >
                  Refresh
                </Button>
              </Box>
            </Box>

            {tables.length > 0 ? (
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={
                            selectedTables.length > 0 &&
                            selectedTables.length < tables.length
                          }
                          checked={tables.length > 0 && selectedTables.length === tables.length}
                          onChange={handleSelectAllTables}
                        />
                      </TableCell>
                      <TableCell>Table Name</TableCell>
                      <TableCell align="right">Rows</TableCell>
                      <TableCell align="right">Size</TableCell>
                      <TableCell align="right">Last Updated</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tables.map((table) => (
                      <TableRow key={table.tableName} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedTables.includes(table.tableName)}
                            onChange={() => handleTableSelection(table.tableName)}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <TableChart sx={{ mr: 1, color: 'action.active' }} />
                            {table.tableName}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          {table.rowCount ? table.rowCount.toLocaleString() : 'N/A'}
                        </TableCell>
                        <TableCell align="right">
                          {table.dataSize 
                            ? formatBytes(table.dataSize)
                            : 'N/A'}
                        </TableCell>
                        <TableCell align="right">
                          {table.updateTime 
                            ? new Date(table.updateTime).toLocaleDateString()
                            : 'N/A'}
                        </TableCell>
                        <TableCell align="center">
                          {sourceServer && targetServer && (
                            <Tooltip title="Compare with target">
                              <IconButton
                                size="small"
                                onClick={() => compareTables(table.tableName)}
                              >
                                <CompareArrows />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="View details">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedServerInfo({ serverId: sourceServer, tableName: table.tableName });
                                setServerDialogOpen(true);
                              }}
                            >
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ p: 2, textAlign: 'center', backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                <Typography color="text.secondary">
                  {sourceServer 
                    ? 'No tables found or error loading tables'
                    : 'Please select a source server to view tables'}
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<Close />}
                onClick={() => {
                  setSourceServer('');
                  setTargetServer('');
                  setSelectedTables([]);
                  setTables([]);
                }}
              >
                Clear All
              </Button>
              <Button
                variant="contained"
                startIcon={
                  loading ? 
                    <CircularProgress size={20} /> : 
                    <PlayArrow />
                }
                onClick={startSync}
                disabled={
                  !sourceServer || 
                  !targetServer || 
                  selectedTables.length === 0 ||
                  loading
                }
                size="large"
              >
                Start Synchronization
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );

  // Komponen Table Explorer
  const TableExplorerTab = () => (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Table Explorer
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Select Server
            </Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Server</InputLabel>
              <Select
                value={sourceServer}
                label="Server"
                onChange={handleSourceServerChange}
              >
                {Object.entries(servers).map(([id, server]) => (
                  <MenuItem key={id} value={id}>
                    {server.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {sourceServer && (
              <>
                <Typography variant="subtitle1" gutterBottom>
                  Tables ({tables.length})
                </Typography>
                <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
                  {tables.map((table) => (
                    <Accordion
                      key={table.tableName}
                      expanded={expandedTable === table.tableName}
                      onChange={() => handleTableExpand(table.tableName)}
                    >
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Box sx={{ width: '100%' }}>
                          <Typography>{table.tableName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {table.rowCount ? table.rowCount.toLocaleString() + ' rows' : 'N/A rows'} • 
                            {table.dataSize ? ' ' + formatBytes(table.dataSize) : ' N/A'}
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        {tableData[table.tableName] ? (
                          <>
                            <Typography variant="subtitle2" gutterBottom>
                              Columns: {tableData[table.tableName].columns?.length || 0}
                            </Typography>
                            <Box sx={{ maxHeight: 200, overflow: 'auto', mb: 2 }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Column</TableCell>
                                    <TableCell>Sample Value</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {tableData[table.tableName].columns?.slice(0, 5).map((column, idx) => (
                                    <TableRow key={column}>
                                      <TableCell>{column}</TableCell>
                                      <TableCell>
                                        {tableData[table.tableName].data?.[0]?.[column]?.toString().substring(0, 30) || 'NULL'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </Box>
                            <Button
                              size="small"
                              onClick={() => {
                                setSelectedServerInfo({ serverId: sourceServer, tableName: table.tableName });
                                setServerDialogOpen(true);
                              }}
                            >
                              View Full Structure
                            </Button>
                          </>
                        ) : (
                          <CircularProgress size={20} />
                        )}
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
              </>
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={8}>
          {expandedTable && tableData[expandedTable] ? (
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Data Preview: {expandedTable}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total: {tableData[expandedTable].total?.toLocaleString()} rows
                </Typography>
              </Box>
              
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      {tableData[expandedTable].columns?.map((column) => (
                        <TableCell key={column}>{column}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableData[expandedTable].data?.map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {tableData[expandedTable].columns?.map((column) => (
                          <TableCell key={column}>
                            {row[column]?.toString().substring(0, 50) || 'NULL'}
                            {row[column]?.toString().length > 50 ? '...' : ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              <TablePagination
                rowsPerPageOptions={[5, 10, 25, 50]}
                component="div"
                count={tableData[expandedTable].total || 0}
                rowsPerPage={tableRowsPerPage}
                page={tablePage}
                onPageChange={handleTablePageChange}
                onRowsPerPageChange={handleTableRowsPerPageChange}
              />
            </Paper>
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Table Selected
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Select a table from the left panel to view its data
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Container>
  );

  // Komponen Sync History
  const SyncHistoryTab = () => (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Sync History
      </Typography>
      
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Recent Sync Jobs ({syncHistory.length})
          </Typography>
          <Button
            startIcon={<Refresh />}
            onClick={fetchSyncHistory}
          >
            Refresh
          </Button>
        </Box>
        
        {syncHistory.length > 0 ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Job ID</TableCell>
                  <TableCell>Source → Target</TableCell>
                  <TableCell>Tables</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Start Time</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {syncHistory.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {job.id.substring(0, 8)}...
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {servers[job.sourceServer]?.name} → {servers[job.targetServer]?.name}
                    </TableCell>
                    <TableCell>{job.tablesCount}</TableCell>
                    <TableCell>
                      <Chip
                        label={job.status}
                        color={getSyncStatusColor(job.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDate(job.startTime)}</TableCell>
                    <TableCell>
                      {job.duration ? `${job.duration}s` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => {
                            axios.get(`${API_BASE_URL}/sync/status/${job.id}`)
                              .then(response => {
                                if (response.data.success) {
                                  setSelectedServerInfo({ type: 'job', data: response.data.job });
                                  setServerDialogOpen(true);
                                }
                              });
                          }}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box sx={{ p: 2, textAlign: 'center', backgroundColor: '#f5f5f5', borderRadius: 1 }}>
            <Typography color="text.secondary">No sync history available</Typography>
          </Box>
        )}
      </Paper>
    </Container>
  );

  // Komponen Settings
  const SettingsTab = () => (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Application Settings
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <TextField
                value={API_BASE_URL}
                label="API Base URL"
                disabled
                helperText="Configure in your environment"
              />
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Enable auto-refresh"
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Show notifications"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Sync Defaults
            </Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Default Days Threshold</InputLabel>
              <Select
                value={syncOptions.daysThreshold}
                label="Default Days Threshold"
                onChange={(e) => setSyncOptions(prev => ({
                  ...prev,
                  daysThreshold: e.target.value
                }))}
              >
                <MenuItem value={1}>1 day</MenuItem>
                <MenuItem value={2}>2 days</MenuItem>
                <MenuItem value={3}>3 days</MenuItem>
                <MenuItem value={7}>7 days</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button variant="outlined">
                Cancel
              </Button>
              <Button variant="contained" startIcon={<CheckCircle />}>
                Save Settings
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          System Information
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Application Version
            </Typography>
            <Typography variant="body1">
              1.0.0
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Last Updated
            </Typography>
            <Typography variant="body1">
              {new Date().toLocaleDateString()}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              Server Status
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              {serverStatus.map((status) => (
                <Chip
                  key={status.server}
                  icon={getStatusIcon(status.success ? 'online' : 'offline')}
                  label={servers[status.server]?.name || status.server}
                  color={status.success ? 'success' : 'error'}
                  size="small"
                />
              ))}
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );

  // Dialog untuk Table Details
  const TableDetailsDialog = () => {
    const [structure, setStructure] = useState(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
      if (selectedServerInfo?.serverId && selectedServerInfo?.tableName) {
        setLoading(true);
        axios.get(`${API_BASE_URL}/servers/${selectedServerInfo.serverId}/tables/${selectedServerInfo.tableName}`)
          .then(response => {
            if (response.data.success) {
              setStructure(response.data);
            }
            setLoading(false);
          })
          .catch(() => {
            setLoading(false);
          });
      }
    }, [selectedServerInfo]);
    
    if (selectedServerInfo?.type === 'job') {
      return (
        <Dialog 
          open={serverDialogOpen} 
          onClose={() => setServerDialogOpen(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            Job Details
            <IconButton
              onClick={() => setServerDialogOpen(false)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {selectedServerInfo.data && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Job ID: {selectedServerInfo.data.id}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Status: {selectedServerInfo.data.status}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Progress: {selectedServerInfo.data.progress}%
                </Typography>
                {selectedServerInfo.data.error && (
                  <Box sx={{ mt: 2, p: 1, backgroundColor: '#ffebee', borderRadius: 1 }}>
                    <Typography color="error">Error: {selectedServerInfo.data.error}</Typography>
                  </Box>
                )}
                {selectedServerInfo.data.details && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2">Table Details:</Typography>
                    {Object.entries(selectedServerInfo.data.details).map(([table, details]) => (
                      <Paper key={table} sx={{ p: 1, mt: 1 }}>
                        <Typography variant="body2">
                          {table}: {details.status} (Rows: {details.rowsFetched || 0})
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setServerDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      );
    }
    
    if (selectedServerInfo?.serverId && selectedServerInfo?.tableName) {
      return (
        <Dialog 
          open={serverDialogOpen} 
          onClose={() => setServerDialogOpen(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            Table Structure: {selectedServerInfo.tableName}
            <IconButton
              onClick={() => setServerDialogOpen(false)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Server: {servers[selectedServerInfo.serverId]?.name}
              </Typography>
              
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : !structure ? (
                <Box sx={{ p: 2, backgroundColor: '#ffebee', borderRadius: 1, mt: 2 }}>
                  <Typography color="error">Failed to load table structure</Typography>
                </Box>
              ) : (
                <>
                  <Typography variant="subtitle1" sx={{ mt: 2 }}>
                    Columns ({structure.structure?.length || 0})
                  </Typography>
                  <TableContainer sx={{ maxHeight: 400 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Column Name</TableCell>
                          <TableCell>Data Type</TableCell>
                          <TableCell>Nullable</TableCell>
                          <TableCell>Key</TableCell>
                          <TableCell>Default</TableCell>
                          <TableCell>Extra</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {structure.structure?.map((column) => (
                          <TableRow key={column.columnName}>
                            <TableCell>{column.columnName}</TableCell>
                            <TableCell>{column.dataType}</TableCell>
                            <TableCell>{column.isNullable}</TableCell>
                            <TableCell>{column.columnKey || '-'}</TableCell>
                            <TableCell>{column.columnDefault || 'NULL'}</TableCell>
                            <TableCell>{column.extra || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle1">
                      Table Information
                    </Typography>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Total Rows
                        </Typography>
                        <Typography variant="body1">
                          {structure.rowCount?.toLocaleString() || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Table Name
                        </Typography>
                        <Typography variant="body1">
                          {structure.tableName}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                </>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setServerDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      );
    }
    
    return null;
  };

  // Dialog untuk Compare Tables
  const CompareDialog = () => (
    <Dialog 
      open={compareDialogOpen} 
      onClose={() => setCompareDialogOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Table Comparison
        <IconButton
          onClick={() => setCompareDialogOpen(false)}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {compareData && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              {compareData.tableName}
            </Typography>
            
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Source ({compareData.sourceServer?.name})
                  </Typography>
                  <Typography variant="h4">
                    {compareData.sourceCount?.toLocaleString()}
                  </Typography>
                  <Typography variant="body2">
                    rows
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Target ({compareData.targetServer?.name})
                  </Typography>
                  <Typography variant="h4">
                    {compareData.targetCount?.toLocaleString()}
                  </Typography>
                  <Typography variant="body2">
                    rows
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
            
            {compareData.differences && compareData.differences.length > 0 ? (
              <>
                <Box sx={{ mb: 2, p: 1, backgroundColor: '#fff3e0', borderRadius: 1 }}>
                  <Typography color="warning.main">
                    Found {compareData.differences.length} differences
                  </Typography>
                </Box>
                
                {compareData.differences.map((diff, index) => (
                  <Accordion key={index}>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography>
                        {diff.type === 'row_count' && 'Row Count Difference'}
                        {diff.type === 'column_missing_in_target' && 'Missing Column in Target'}
                        {diff.type === 'column_missing_in_source' && 'Missing Column in Source'}
                        {diff.type === 'column_type_mismatch' && 'Column Type Mismatch'}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      {diff.type === 'row_count' && (
                        <Typography>
                          Source has {diff.source} rows, Target has {diff.target} rows. 
                          Difference: {diff.difference > 0 ? '+' : ''}{diff.difference} rows.
                        </Typography>
                      )}
                      {diff.type === 'column_missing_in_target' && (
                        <Typography>
                          Column(s) missing in target: {diff.columns?.join(', ')}
                        </Typography>
                      )}
                      {diff.type === 'column_missing_in_source' && (
                        <Typography>
                          Column(s) missing in source: {diff.columns?.join(', ')}
                        </Typography>
                      )}
                      {diff.type === 'column_type_mismatch' && (
                        <Typography>
                          Column "{diff.column}" type mismatch: 
                          Source is {diff.sourceType}, Target is {diff.targetType}
                        </Typography>
                      )}
                    </AccordionDetails>
                  </Accordion>
                ))}
              </>
            ) : (
              <Box sx={{ p: 1, backgroundColor: '#e8f5e9', borderRadius: 1 }}>
                <Typography color="success.main">
                  Tables are synchronized. No differences found.
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setCompareDialogOpen(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Snackbar untuk notifikasi */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <AlertComponent 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </AlertComponent>
      </Snackbar>

      {/* Drawer untuk navigasi */}
      <Drawer
        variant="permanent"
        open={drawerOpen}
        sx={{
          width: drawerOpen ? 240 : 70,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerOpen ? 240 : 70,
            boxSizing: 'border-box',
            overflowX: 'hidden',
            transition: 'width 0.3s',
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {drawerOpen && (
            <Typography variant="h6" noWrap>
              DB Sync Manager
            </Typography>
          )}
          <IconButton onClick={handleDrawerToggle}>
            {drawerOpen ? <ChevronLeft /> : <MenuIcon />}
          </IconButton>
        </Box>
        
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.id} disablePadding>
              <ListItemButton
                selected={activeTab === item.id}
                onClick={() => handleTabChange(null, item.id)}
                sx={{
                  minHeight: 48,
                  justifyContent: drawerOpen ? 'initial' : 'center',
                  px: 2.5,
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: drawerOpen ? 3 : 'auto',
                    justifyContent: 'center',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {drawerOpen && <ListItemText primary={item.text} />}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        
        <Divider />
        
        <Box sx={{ p: 2, mt: 'auto' }}>
          {drawerOpen && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar sx={{ mr: 2 }}>
                <Person />
              </Avatar>
              <Box>
                <Typography variant="body2">Admin User</Typography>
                <Typography variant="caption" color="text.secondary">
                  Database Administrator
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Drawer>

      {/* Main content */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, ml: drawerOpen ? 0 : 0 }}>
        {/* App Bar */}
        <Paper sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h5">
            {menuItems.find(item => item.id === activeTab)?.text || 'Dashboard'}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              icon={<Sync />}
              label={`${activeJobs.length} Active`}
              color={activeJobs.length > 0 ? 'primary' : 'default'}
              size="small"
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<Refresh />}
              onClick={() => {
                fetchServers();
                fetchActiveJobs();
                showSnackbar('Refreshed all data', 'success');
              }}
            >
              Refresh
            </Button>
          </Box>
        </Paper>

        {/* Render active tab */}
        {activeTab === 0 && <DashboardTab />}
        {activeTab === 1 && <ServerStatusTab />}
        {activeTab === 2 && <SyncManagerTab />}
        {activeTab === 3 && <TableExplorerTab />}
        {activeTab === 4 && <SyncHistoryTab />}
        {activeTab === 5 && <SettingsTab />}
      </Box>

      {/* Dialogs */}
      <TableDetailsDialog />
      <CompareDialog />
    </Box>
  );
}

// Render aplikasi
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);