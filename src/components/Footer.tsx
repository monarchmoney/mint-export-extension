import MonarchLogo from '@assets/img/logo.svg';

import Text from '@root/src/components/Text';
import Section from '@root/src/components/Section';

const Footer = () => (
  <a
    className="cursor-pointer"
    href="https://www.monarchmoney.com?utm_source=mint_export_extension"
    target="_blank"
    rel="noopener noreferrer">
    <Section className="cursor-pointer border-0 border-t transition-all hover:bg-zinc-50">
      <div className="flex flex-col gap-2">
        <Text type="subtitle">Powered by</Text>
        <img src={MonarchLogo} alt="Monarch Logo" className="w-[125px]" />
      </div>
    </Section>
  </a>
);

export default Footer;
