import type { Metadata } from "next";
import { PhysicsEditor } from "@/app/components/PhysicsEditor";

export const metadata: Metadata = {
  title: "力学図エディタ",
  description: "物理図を、考える速さで。変量と制約を理解する力学図専用エディタ。",
};

export default function Home() {
  return <PhysicsEditor />;
}
