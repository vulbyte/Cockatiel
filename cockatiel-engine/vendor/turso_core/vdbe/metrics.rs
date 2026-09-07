use std::fmt;

/// Statement-level execution metrics
///
/// These metrics are collected unconditionally during statement execution
/// with minimal overhead (simple counter increments). The cost of incrementing
/// these counters is negligible compared to the actual work being measured.
#[derive(Debug, Default, Clone)]
pub struct StatementMetrics {
    // Row operations
    pub rows_read: u64,
    pub rows_written: u64,

    // Execution statistics
    pub vm_steps: u64,
    pub insn_executed: u64,

    // Table scan metrics
    pub fullscan_steps: u64,
    pub index_steps: u64,

    // Sort and filter operations
    pub sort_operations: u64,
    pub filter_operations: u64,

    // B-tree operations
    pub btree_seeks: u64,
    pub btree_next: u64,
    pub btree_prev: u64,
}

impl StatementMetrics {
    pub fn new() -> Self {
        Self::default()
    }

    /// Get total row operations
    pub fn total_row_ops(&self) -> u64 {
        self.rows_read + self.rows_written
    }

    /// Merge another metrics instance into this one (for aggregation)
    pub fn merge(&mut self, other: &StatementMetrics) {
        self.rows_read = self.rows_read.saturating_add(other.rows_read);
        self.rows_written = self.rows_written.saturating_add(other.rows_written);
        self.vm_steps = self.vm_steps.saturating_add(other.vm_steps);
        self.insn_executed = self.insn_executed.saturating_add(other.insn_executed);
        self.fullscan_steps = self.fullscan_steps.saturating_add(other.fullscan_steps);
        self.index_steps = self.index_steps.saturating_add(other.index_steps);
        self.sort_operations = self.sort_operations.saturating_add(other.sort_operations);
        self.filter_operations = self
            .filter_operations
            .saturating_add(other.filter_operations);
        self.btree_seeks = self.btree_seeks.saturating_add(other.btree_seeks);
        self.btree_next = self.btree_next.saturating_add(other.btree_next);
        self.btree_prev = self.btree_prev.saturating_add(other.btree_prev);
    }

    /// Reset all counters to zero
    pub fn reset(&mut self) {
        *self = Self::default();
    }
}

impl fmt::Display for StatementMetrics {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        writeln!(f, "Statement Metrics:")?;
        writeln!(f, "  Row Operations:")?;
        writeln!(f, "    Rows read:        {}", self.rows_read)?;
        writeln!(f, "    Rows written:     {}", self.rows_written)?;
        writeln!(f, "  Execution:")?;
        writeln!(f, "    VM steps:         {}", self.vm_steps)?;
        writeln!(f, "    Instructions:     {}", self.insn_executed)?;
        writeln!(f, "  Table Access:")?;
        writeln!(f, "    Full scan steps:  {}", self.fullscan_steps)?;
        writeln!(f, "    Index steps:      {}", self.index_steps)?;
        writeln!(f, "  Operations:")?;
        writeln!(f, "    Sort operations:  {}", self.sort_operations)?;
        writeln!(f, "    Filter operations:{}", self.filter_operations)?;
        writeln!(f, "  B-tree Operations:")?;
        writeln!(f, "    Seeks:            {}", self.btree_seeks)?;
        writeln!(f, "    Next:             {}", self.btree_next)?;
        writeln!(f, "    Prev:             {}", self.btree_prev)?;
        Ok(())
    }
}

/// Connection-level metrics aggregation
#[derive(Debug, Default, Clone)]
pub struct ConnectionMetrics {
    /// Total number of statements executed
    pub total_statements: u64,

    /// Aggregate metrics from all statements
    pub aggregate: StatementMetrics,

    /// Metrics from the last executed statement
    pub last_statement: Option<StatementMetrics>,

    /// High-water marks for monitoring
    pub max_vm_steps_per_statement: u64,
    pub max_rows_read_per_statement: u64,
}

impl ConnectionMetrics {
    pub fn new() -> Self {
        Self::default()
    }

    /// Record a completed statement's metrics
    pub fn record_statement(&mut self, metrics: StatementMetrics) {
        self.total_statements = self.total_statements.saturating_add(1);

        // Update high-water marks
        self.max_vm_steps_per_statement = self.max_vm_steps_per_statement.max(metrics.vm_steps);
        self.max_rows_read_per_statement = self.max_rows_read_per_statement.max(metrics.rows_read);

        // Aggregate into total
        self.aggregate.merge(&metrics);

        // Keep last statement for debugging
        self.last_statement = Some(metrics);
    }

    /// Reset connection metrics
    pub fn reset(&mut self) {
        *self = Self::default();
    }
}

impl fmt::Display for ConnectionMetrics {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        writeln!(f, "Connection Metrics:")?;
        writeln!(f, "  Total statements:     {}", self.total_statements)?;
        writeln!(f, "  High-water marks:")?;
        writeln!(
            f,
            "    Max VM steps:       {}",
            self.max_vm_steps_per_statement
        )?;
        writeln!(
            f,
            "    Max rows read:      {}",
            self.max_rows_read_per_statement
        )?;
        writeln!(f)?;
        writeln!(f, "Aggregate Statistics:")?;
        write!(f, "{}", self.aggregate)?;

        if let Some(ref last) = self.last_statement {
            writeln!(f)?;
            writeln!(f, "Last Statement:")?;
            write!(f, "{last}")?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_merge() {
        let mut m1 = StatementMetrics::new();
        m1.rows_read = 100;
        m1.vm_steps = 50;

        let mut m2 = StatementMetrics::new();
        m2.rows_read = 200;
        m2.vm_steps = 75;

        m1.merge(&m2);
        assert_eq!(m1.rows_read, 300);
        assert_eq!(m1.vm_steps, 125);
    }

    #[test]
    fn test_connection_metrics_high_water() {
        let mut conn_metrics = ConnectionMetrics::new();

        let mut stmt1 = StatementMetrics::new();
        stmt1.vm_steps = 100;
        stmt1.rows_read = 50;
        conn_metrics.record_statement(stmt1);

        let mut stmt2 = StatementMetrics::new();
        stmt2.vm_steps = 75;
        stmt2.rows_read = 100;
        conn_metrics.record_statement(stmt2);

        assert_eq!(conn_metrics.max_vm_steps_per_statement, 100);
        assert_eq!(conn_metrics.max_rows_read_per_statement, 100);
        assert_eq!(conn_metrics.total_statements, 2);
        assert_eq!(conn_metrics.aggregate.vm_steps, 175);
        assert_eq!(conn_metrics.aggregate.rows_read, 150);
    }
}
