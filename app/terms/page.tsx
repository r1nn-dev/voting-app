import type { Metadata } from "next";
import { POLL_LIMITS } from "@/lib/poll-limits";
import { DocPage, DocSection } from "../doc-page";
import { REPOSITORY, SERVICE_NAME } from "../site-footer";

export const metadata: Metadata = { title: `이용약관 · ${SERVICE_NAME}` };

export default function TermsPage() {
  return (
    <DocPage
      title="이용약관"
      intro={`${SERVICE_NAME}를 이용할 때 지켜 주셔야 할 내용과 데이터 처리 방식을 안내합니다.`}
      updated="2026년 9월 29일"
    >
      <DocSection title="제1조 (서비스의 성격)">
        <p>
          {SERVICE_NAME}는 개인이 학습 목적으로 만든 무료 투표 서비스입니다. 서비스의 내용은 예고 없이
          바뀌거나 중단될 수 있으며, 서비스의 정확성·지속성에 대해 별도의 보증을 제공하지 않습니다.
        </p>
      </DocSection>

      <DocSection title="제2조 (이용 방법)">
        <ul className="flex flex-col gap-1.5">
          <li>가입이나 로그인 없이 누구나 투표할 수 있습니다.</li>
          <li>한 투표에는 한 표만 던질 수 있으며, 던진 표는 바꾸거나 취소할 수 없습니다.</li>
          <li>
            투표는 마감 예정 시각이 지나면 자동으로 마감되며, 결과는 마감된 뒤에만 공개됩니다.
          </li>
        </ul>
      </DocSection>

      <DocSection title="제3조 (금지 행위)">
        <p>다음 행위를 해서는 안 됩니다.</p>
        <ul className="flex flex-col gap-1.5">
          <li>한 사람이 같은 투표에 여러 번 표를 던지려는 행위</li>
          <li>프로그램 등을 이용해 자동으로 표를 던지거나 대량의 요청을 보내는 행위</li>
          <li>서비스의 정상적인 운영을 방해하거나, 허가 없이 권한이 필요한 기능에 접근하려는 행위</li>
          <li>다른 사람의 권리를 침해하거나 법령에 어긋나는 행위</li>
        </ul>
        <p>이런 행위로 기록된 표는 결과의 공정성을 위해 삭제될 수 있습니다.</p>
      </DocSection>

      <DocSection title="제4조 (투표와 결과의 공개)">
        <ul className="flex flex-col gap-1.5">
          <li>마감 전에는 선택지별 표 수와 전체 표 수를 공개하지 않습니다.</li>
          <li>
            마감된 투표의 결과는 마감 후 {POLL_LIMITS.publicDays}일 동안 공개되며, 그 뒤에는 공개가
            끝납니다.
          </li>
          <li>투표는 서비스 사정에 따라 예고 없이 삭제될 수 있습니다.</li>
        </ul>
      </DocSection>

      <DocSection title="제5조 (데이터 처리)">
        <ul className="flex flex-col gap-1.5">
          <li>
            이름, 이메일, 전화번호 등 <strong>개인을 알아볼 수 있는 정보는 수집하지 않습니다.</strong>
          </li>
          <li>
            같은 투표에 한 표만 던지도록, 처음 투표할 때 브라우저에 무작위 식별 값이 담긴 쿠키를 저장합니다.
            이 쿠키는 1년 동안 유지되며, 누구인지를 알아내는 데 쓰이지 않습니다.
          </li>
          <li>표를 던지면 어떤 선택지를 골랐는지와 그 시각이 투표 결과 집계를 위해 저장됩니다.</li>
          <li>
            투표가 삭제되면 그 투표의 선택지와 표도 함께 지워집니다. 브라우저의 쿠키는 언제든 직접 지울
            수 있습니다.
          </li>
        </ul>
      </DocSection>

      <DocSection title="제6조 (책임의 제한)">
        <p>
          {SERVICE_NAME}는 학습용 서비스이므로, 투표 결과를 중요한 의사 결정의 유일한 근거로 쓰지 않기를
          권합니다. 서비스 이용이나 장애로 생긴 손해에 대해서는 책임을 지지 않습니다.
        </p>
      </DocSection>

      <DocSection title="제7조 (문의)">
        <p>
          서비스에 관한 문의나 문제 제보는{" "}
          <a
            href={`https://${REPOSITORY}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            GitHub 저장소의 Issues
          </a>
          에 남겨 주세요.
        </p>
      </DocSection>
    </DocPage>
  );
}
