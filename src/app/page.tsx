import { redirect } from "next/navigation";

// 根路径：登录态已由 middleware 处理（未登录跳 /login），此处直接进入上传页。
export default function Page() {
  redirect("/upload");
}