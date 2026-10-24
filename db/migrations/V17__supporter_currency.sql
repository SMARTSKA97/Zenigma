-- A contribution keeps the money as it was paid. When it was not rupees, the rate of that moment is kept too, so the rupee value never moves later.
ALTER TABLE supporter_contributions ADD COLUMN currency varchar(3) NOT NULL DEFAULT 'INR';
ALTER TABLE supporter_contributions ADD COLUMN original_amount numeric(12,2);
ALTER TABLE supporter_contributions ADD COLUMN rate_to_inr numeric(12,4);
