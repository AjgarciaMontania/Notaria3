export const formatNumberWithPoints = (num) => {
  if (!num && num !== 0) return "";
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export const parseNumberWithoutPoints = (str) => {
  if (!str) return 0;
  return parseFloat(str.replace(/[^0-9]/g, "")) || 0;
};

export const formatCOP = (num) => {
  if (!num && num !== 0) return "$0";
  return num.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};