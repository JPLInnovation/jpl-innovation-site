const vnd = new Intl.NumberFormat("vi-VN");

/** 1500000 → "1.500.000 ₫" */
export const formatVnd = (n: number) => `${vnd.format(n)} ₫`;
