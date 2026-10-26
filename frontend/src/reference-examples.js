// Each example uses only the room crop from its matching generated main board.
export const REFERENCE_EXAMPLES = [
  { id: "L01", title: "舒展横床", style: "原木清新", width: 759, height: 785 },
  { id: "L02", title: "动静分区", style: "奶油法式", width: 652, height: 998 },
  { id: "L03", title: "临窗安眠", style: "现代极简", width: 652, height: 917 },
  { id: "L04", title: "转角独处", style: "意式轻奢", width: 647, height: 768 },
  { id: "L05", title: "收纳有序", style: "日式侘寂", width: 680, height: 948 },
  { id: "L06", title: "转角办公", style: "北欧复古", width: 663, height: 1060 },
].map((example, index) => ({
  ...example,
  file: `${example.id}-${example.title}-核心.png`,
  image: `/assets/inspiration/${example.id}.png`,
  sourceFile: `${index + 1}-${example.style}.png`,
  sourceImage: `/assets/reference-sources/${example.id}.png`,
}));
